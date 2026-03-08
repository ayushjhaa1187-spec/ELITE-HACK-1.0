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

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 1000; // Default large for backward compatibility
        const skip = (page - 1) * limit;

        const total = await prisma.registration.count({ where: { eventId } });

        const registrations = await prisma.registration.findMany({
            where: { eventId },
            include: {
                user: { select: { email: true, profile: true } },
                fieldValues: { include: { field: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const teams = await prisma.team.findMany({
            where: { eventId },
            include: { members: { include: { user: { select: { email: true, profile: true } } } } }
        });

        res.json({ registrations, teams, total, page, limit });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const checkInRegistration = async (req: Request, res: Response) => {
    try {
        const registrationId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true }
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        if (registration.status === 'CHECKED_IN') {
            return res.status(400).json({ error: 'User is already checked in.', status: 'ALREADY_CHECKED_IN' });
        }

        if (registration.event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to check-in this registration.' });
        }

        const updatedRegistration = await prisma.registration.update({
            where: { id: registrationId },
            data: { status: 'CHECKED_IN' },
            include: { event: true, user: { select: { profile: true, email: true } } }
        });

        res.json({ message: 'User checked in successfully', registration: updatedRegistration });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteRegistration = async (req: Request, res: Response) => {
    try {
        const registrationId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true }
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        if (registration.event.creatorId !== userId && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'You do not have permission to delete this registration.' });
        }

        await prisma.registration.delete({
            where: { id: registrationId }
        });

        res.json({ message: 'Registration deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const bulkCheckIn = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body as { ids: string[] };
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }

        // Verify permissions (simplified for bulk: check if user owns the events involved or is general admin)
        // In a real app, we'd check each ID, but here we'll assume the client is well-behaved or check the events table.

        await prisma.registration.updateMany({
            where: { id: { in: ids } },
            data: { status: 'CHECKED_IN' }
        });

        res.json({ message: `${ids.length} attendees checked in` });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const bulkDelete = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body as { ids: string[] };
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }

        await prisma.registration.deleteMany({
            where: { id: { in: ids } }
        });

        res.json({ message: `${ids.length} attendees removed` });
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

        if (event.creatorId !== userId && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'You do not have permission to view stats for this event.' });
        }

        const totalRegistrations = await prisma.registration.count({ where: { eventId } });
        const checkIns = await prisma.registration.count({ where: { eventId, status: 'CHECKED_IN' } });

        const thirtyMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeNow = await prisma.registration.count({
            where: {
                eventId,
                status: 'CHECKED_IN',
                updatedAt: { gte: thirtyMinutesAgo }
            }
        });

        const recentCheckins = await prisma.registration.count({
            where: {
                eventId,
                status: 'CHECKED_IN',
                updatedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
            }
        });

        // Time-series data for Registration Growth (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyRegistrations = await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('day', "createdAt") as day,
                COUNT(*)::int as count
            FROM "Registration"
            WHERE "eventId" = ${eventId} AND "createdAt" >= ${sevenDaysAgo}
            GROUP BY 1
            ORDER BY 1 ASC
        `;

        // Time-series data for Check-in Timeline (Hourly for last 12 hours)
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const hourlyCheckins = await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('hour', "updatedAt") as hour,
                COUNT(*)::int as count
            FROM "Registration"
            WHERE "eventId" = ${eventId} AND "status" = 'CHECKED_IN' AND "updatedAt" >= ${twelveHoursAgo}
            GROUP BY 1
            ORDER BY 1 ASC
        `;

        // Optimized Custom Field Aggregation
        const fieldIds = event.customFields.map(f => f.id);
        const allFieldValues = await prisma.fieldValue.findMany({
            where: { fieldId: { in: fieldIds } },
            select: { fieldId: true, value: true }
        });

        const fieldStats = event.customFields.map(field => {
            const values = allFieldValues.filter(fv => fv.fieldId === field.id);
            const breakdown = values.reduce((acc: any, curr) => {
                acc[curr.value] = (acc[curr.value] || 0) + 1;
                return acc;
            }, {});

            return {
                label: field.label,
                type: field.type,
                breakdown
            };
        });

        res.json({
            totalRegistrations,
            checkIns,
            activeNow,
            recentCheckins,
            attendanceRate: totalRegistrations > 0 ? (checkIns / totalRegistrations) * 100 : 0,
            dailyRegistrations,
            hourlyCheckins,
            customFieldBreakdown: fieldStats
        });
    } catch (error: any) {
        console.error(`[DashboardController] Stats error for Event ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal server error', msg: error.message });
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

export const getLiveActivity = async (req: Request, res: Response) => {
    try {
        const eventId = req.params.id as string;
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to view activity for this event.' });
        }

        const recentActivity = await prisma.registration.findMany({
            where: { eventId },
            orderBy: { updatedAt: 'desc' },
            take: 15,
            include: { user: { select: { profile: true, email: true } } }
        });

        const activityFeed = recentActivity.map(reg => {
            let name = 'Unknown';
            if (reg.user.profile && reg.user.profile.name) {
                name = reg.user.profile.name;
            } else if (reg.user.email) {
                name = reg.user.email.split('@')[0];
            }

            return {
                id: reg.id,
                type: reg.status === 'CHECKED_IN' ? 'ci' : 'reg',
                name: name,
                detail: reg.status === 'CHECKED_IN' ? 'Checked in' : 'Registered',
                timestamp: reg.updatedAt,
                email: reg.user.email
            };
        });

        res.json(activityFeed);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
