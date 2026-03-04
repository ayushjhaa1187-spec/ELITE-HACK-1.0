import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { announcementSchema } from '../utils/validation';
import { notifyUsers } from '../utils/notificationService';
import { SecurityService } from '../utils/security';

export const getEventAnnouncements = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;

        // Check if event exists
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const announcements = await prisma.announcement.findMany({
            where: { eventId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(announcements);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createAnnouncement = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const validatedData = announcementSchema.parse(req.body);

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (!SecurityService.canManageEvent(userId, event)) {
            return res.status(403).json({ error: 'You do not have permission to create announcements for this event.' });
        }

        const announcement = await prisma.announcement.create({
            data: {
                eventId,
                message: validatedData.message
            }
        });

        // Handle mock notifications
        const registrations = await prisma.registration.findMany({
            where: { eventId },
            include: { user: true }
        });
        const individualUsers = registrations.map(reg => ({ id: reg.user.id, email: reg.user.email }));

        const teamMembers = await prisma.teamMember.findMany({
            where: { team: { eventId } },
            include: { user: true }
        });
        const teamUsers = teamMembers.map(member => ({ id: member.user.id, email: member.user.email }));

        // Dedup users who might be in both (shouldn't happen per business logic, but safe)
        const allUsersMap = new Map<string, { id: string; email: string }>();
        [...individualUsers, ...teamUsers].forEach(u => allUsersMap.set(u.email, u));

        notifyUsers(
            Array.from(allUsersMap.values()),
            `New Announcement for ${event.title}`,
            validatedData.message
        );

        // Create in-app notifications
        const notificationData = Array.from(allUsersMap.values()).map(u => ({
            userId: u.id,
            title: `New Announcement for ${event.title}`,
            message: validatedData.message
        }));

        if (notificationData.length > 0) {
            await prisma.notification.createMany({
                data: notificationData
            });
        }

        res.status(201).json({ message: 'Announcement created and notifications sent', announcement });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getEventAttendees = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to view attendees for this event.' });
        }

        const registrations = await prisma.registration.findMany({
            where: { eventId },
            include: {
                user: { select: { email: true, profile: true } },
                fieldValues: { include: { field: true } }
            }
        });

        const teams = await prisma.team.findMany({
            where: { eventId },
            include: { members: { include: { user: { select: { email: true, profile: true } } } } }
        });

        res.json({ registrations, teams });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const checkInRegistration = async (req: Request, res: Response) => {
    try {
        // req.params.id is the registrationId or teamId? According to docs: POST /api/admin/registrations/:id/checkin
        const registrationId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true }
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        if (registration.event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to check-in this registration.' });
        }

        const updatedRegistration = await prisma.registration.update({
            where: { id: registrationId },
            data: { status: 'CHECKED_IN' }
        });

        res.json({ message: 'User checked in successfully', registration: updatedRegistration });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getEventStats = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { customFields: true }
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to view stats for this event.' });
        }

        const totalRegistrations = await prisma.registration.count({ where: { eventId } });
        const checkIns = await prisma.registration.count({ where: { eventId, status: 'CHECKED_IN' } });

        // Aggregate custom fields
        const fieldStats: any[] = [];

        for (const field of event.customFields) {
            const values = await prisma.fieldValue.findMany({
                where: { fieldId: field.id },
                select: { value: true }
            });

            const counts = values.reduce((acc: any, curr) => {
                acc[curr.value] = (acc[curr.value] || 0) + 1;
                return acc;
            }, {});

            fieldStats.push({
                label: field.label,
                type: field.type,
                breakdown: counts
            });
        }

        res.json({
            totalRegistrations,
            checkIns,
            attendanceRate: totalRegistrations > 0 ? (checkIns / totalRegistrations) * 100 : 0,
            customFieldBreakdown: fieldStats
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const sendEventReminder = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to send reminders for this event.' });
        }

        const registrations = await prisma.registration.findMany({
            where: { eventId },
            include: { user: true }
        });

        const notificationData = registrations.map(reg => ({
            userId: reg.userId,
            title: `Reminder: ${event.title}`,
            message: `Don't forget! The event starts on ${event.startDate.toLocaleString()}. We look forward to seeing you!`
        }));

        if (notificationData.length > 0) {
            await prisma.notification.createMany({
                data: notificationData
            });
        }

        res.json({ message: `Reminder sent to ${notificationData.length} participants.` });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
