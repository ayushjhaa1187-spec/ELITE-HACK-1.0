import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { eventSchema } from '../utils/validation';

export const createEvent = async (req: Request, res: Response) => {
    try {
        const validatedData = eventSchema.parse(req.body);
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { schedules, customFields, ...rest } = validatedData;
        const event = await prisma.event.create({
            data: {
                ...rest,
                startDate: new Date(rest.startDate),
                endDate: new Date(rest.endDate),
                registrationStart: new Date(rest.registrationStart),
                registrationEnd: new Date(rest.registrationEnd),
                creatorId: userId,
                schedules: schedules ? {
                    create: schedules.map((s: any) => ({
                        ...s,
                        startTime: new Date(s.startTime),
                        endTime: new Date(s.endTime),
                    }))
                } : undefined,
                customFields: customFields ? {
                    create: customFields
                } : undefined,
            },
            include: {
                schedules: true,
                customFields: true,
            }
        });

        res.status(201).json(event);
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error', msg: error.message });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({ where: { id } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to update this event.' });
        }

        const { schedules, customFields, ...rest } = eventSchema.partial().parse(req.body);

        const updatedEvent = await prisma.event.update({
            where: { id },
            data: {
                ...rest,
                ...(rest.startDate && { startDate: new Date(rest.startDate) }),
                ...(rest.endDate && { endDate: new Date(rest.endDate) }),
                ...(rest.registrationStart && { registrationStart: new Date(rest.registrationStart) }),
                ...(rest.registrationEnd && { registrationEnd: new Date(rest.registrationEnd) }),
            },
        });

        res.json(updatedEvent);
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteEvent = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({ where: { id } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to delete this event.' });
        }

        await prisma.event.delete({ where: { id } });

        res.json({ message: 'Event successfully deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAdminEvents = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const events = await prisma.event.findMany({
            where: { creatorId: userId },
            orderBy: { startDate: 'desc' },
            include: {
                _count: {
                    select: { registrations: true, teams: true },
                },
            },
        });

        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPublicEvents = async (req: Request, res: Response) => {
    try {
        const { domain, tag } = req.query;
        const events = await prisma.event.findMany({
            orderBy: { startDate: 'asc' },
            where: {
                endDate: {
                    gte: new Date(),
                },
                ...(domain && { domain: domain as string }),
                ...(tag && { tags: { contains: tag as string } })
            },
            include: {
                creator: {
                    select: { profile: true }
                },
                schedules: true,
                customFields: true,
            }
        });

        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getEventDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                creator: { select: { profile: true } },
                _count: { select: { registrations: true, teams: true } },
                schedules: true,
                customFields: true,
            }
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        res.json(event);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
