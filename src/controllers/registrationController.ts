import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { createTeamSchema, joinTeamSchema } from '../utils/validation';
import crypto from 'crypto';
import QRCode from 'qrcode';

export const registerForEvent = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { customFields: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const now = new Date();
        if (now < event.registrationStart || now > event.registrationEnd) {
            return res.status(400).json({ error: 'Registration is not open for this event' });
        }

        const existingReg = await prisma.registration.findFirst({
            where: { eventId, userId }
        });
        if (existingReg) {
            return res.status(400).json({ error: 'User is already registered for this event' });
        }

        // Handle Custom Fields & Type Validation
        const { fieldValues } = req.body;
        const missingFields = event.customFields.filter(cf => cf.required && !fieldValues?.find((fv: any) => fv.fieldId === cf.id));

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required registration fields',
                fields: missingFields.map(f => ({ id: f.id, label: f.label }))
            });
        }

        // Validate types
        if (fieldValues) {
            for (const fv of fieldValues) {
                const field = event.customFields.find(cf => cf.id === fv.fieldId);
                if (!field) continue;

                if (field.type === 'NUMBER' && isNaN(Number(fv.value))) {
                    return res.status(400).json({ error: `Field "${field.label}" must be a number` });
                }
                if (field.type === 'BOOLEAN' && !['true', 'false', true, false].includes(fv.value)) {
                    return res.status(400).json({ error: `Field "${field.label}" must be a boolean` });
                }
            }
        }

        const registration = await prisma.registration.create({
            data: {
                eventId,
                userId,
                fieldValues: fieldValues ? {
                    create: fieldValues.map((fv: any) => ({
                        fieldId: fv.fieldId,
                        value: String(fv.value) // Store as string in DB
                    }))
                } : undefined
            },
            include: {
                fieldValues: true,
                user: { select: { profile: true } }
            }
        });

        // Notify Admin (Creator)
        await prisma.notification.create({
            data: {
                userId: event.creatorId,
                title: `New Registration: ${event.title}`,
                message: `${registration.user.profile?.name || 'A user'} has registered for your event.`
            }
        });

        res.status(201).json({ message: 'Successfully registered for event', registration });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error', msg: error.message });
    }
};

export const createTeam = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const validatedData = createTeamSchema.parse(req.body);

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const now = new Date();
        if (now < event.registrationStart || now > event.registrationEnd) {
            return res.status(400).json({ error: 'Team creation is only allowed during the registration window' });
        }

        // Check if user is already in a team for this event
        const existingTeamMember = await prisma.teamMember.findFirst({
            where: {
                userId,
                team: { eventId }
            }
        });

        if (existingTeamMember) {
            return res.status(400).json({ error: 'User is already part of a team for this event' });
        }

        const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const team = await prisma.team.create({
            data: {
                name: validatedData.name,
                eventId,
                inviteCode,
                members: {
                    create: {
                        userId,
                        role: 'LEADER'
                    }
                }
            },
            include: {
                members: true
            }
        });

        res.status(201).json({ message: 'Team created successfully', team });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const joinTeam = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const validatedData = joinTeamSchema.parse(req.body);

        const team = await prisma.team.findUnique({
            where: { inviteCode: validatedData.inviteCode },
            include: { event: true, members: true }
        });

        if (!team) return res.status(404).json({ error: 'Invalid invite code' });

        // Check if user is already in a team for this event
        const existingTeamMember = await prisma.teamMember.findFirst({
            where: {
                userId,
                team: { eventId: team.eventId }
            }
        });

        if (existingTeamMember) {
            return res.status(400).json({ error: 'User is already part of a team for this event' });
        }

        if (team.members.length >= team.event.maxTeamSize) {
            return res.status(400).json({ error: 'Team is already full' });
        }

        const teamMember = await prisma.teamMember.create({
            data: {
                userId,
                teamId: team.id,
                role: 'MEMBER' // Default role
            }
        });

        res.json({ message: 'Successfully joined team', teamMember });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getUserRegistrations = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const registrations = await prisma.registration.findMany({
            where: { userId },
            include: { event: true }
        });

        const teams = await prisma.teamMember.findMany({
            where: { userId },
            include: { team: { include: { event: true, members: { include: { user: { select: { profile: true } } } } } } }
        });

        res.json({ registrations, teams });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRegistrationTicket = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const registration = await prisma.registration.findFirst({
            where: { eventId, userId },
            include: { user: { select: { profile: true } }, event: { select: { title: true } } }
        });

        if (!registration) return res.status(404).json({ error: 'You are not registered for this event.' });

        res.json({
            ticketId: registration.id,
            participantName: registration.user.profile?.name,
            eventName: registration.event.title,
            checkInStatus: registration.status
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRegistrationQR = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const registration = await prisma.registration.findFirst({
            where: { eventId, userId },
            include: {
                user: { select: { profile: true, email: true } },
                event: { select: { title: true, startDate: true } }
            }
        });

        if (!registration) {
            return res.status(404).json({ error: 'You are not registered for this event.' });
        }

        // Encode check-in data into the QR code
        const qrPayload = JSON.stringify({
            registrationId: registration.id,
            eventId: registration.eventId,
            userId: registration.userId,
            eventName: registration.event.title,
            participantName: registration.user.profile?.name || registration.user.email,
            checkInStatus: registration.status,
        });

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.json({
            ticketId: registration.id,
            participantName: registration.user.profile?.name,
            eventName: registration.event.title,
            eventDate: registration.event.startDate,
            checkInStatus: registration.status,
            qrCode: qrDataUrl,
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
