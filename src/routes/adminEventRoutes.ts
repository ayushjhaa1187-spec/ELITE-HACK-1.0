import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import prisma from '../utils/prisma';
import {
    createEvent,
    updateEvent,
    deleteEvent,
    getAdminEvents,
} from '../controllers/eventController';
import {
    createAnnouncement,
    getEventAttendees,
    getEventStats,
    sendEventReminder,
    getLiveActivity,
} from '../controllers/dashboardController';

const router = Router();

// Admin Routes for events
router.post('/', authenticate, requireAdmin, createEvent);
router.get('/', authenticate, requireAdmin, getAdminEvents);
router.put('/:id', authenticate, requireAdmin, updateEvent);
router.delete('/:id', authenticate, requireAdmin, deleteEvent);
router.post('/:id/announcements', authenticate, requireAdmin, createAnnouncement);
router.get('/:id/attendees', authenticate, requireAdmin, getEventAttendees);
router.get('/:id/stats', authenticate, requireAdmin, getEventStats);
router.get('/dashboard', authenticate, requireAdmin, (req, res, next) => {
    // Adapter to handle the requested /api/admin/dashboard?eventId=... or similar
    // The frontend code suggests a generic /api/admin/dashboard call.
    // We'll use the eventId from query or fallback to the latest event created by the user.
    next();
}, async (req, res) => {
    try {
        const userId = req.user?.id;
        const eventId = req.query.eventId as string;

        let event;
        if (eventId) {
            event = await prisma.event.findUnique({ where: { id: eventId } });
        } else {
            event = await prisma.event.findFirst({
                where: { creatorId: userId },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (!event) return res.status(404).json({ error: 'No event found' });

        const totalRegistered = await prisma.registration.count({ where: { eventId: event.id } });
        const checkedIn = await prisma.registration.count({ where: { eventId: event.id, status: 'CHECKED_IN' } });
        const vipCount = await prisma.registration.count({
            where: {
                eventId: event.id,
                OR: [
                    { fieldValues: { some: { value: { contains: 'VIP', mode: 'insensitive' } } } },
                    { user: { email: { contains: 'vip', mode: 'insensitive' } } }
                ]
            }
        });

        // Recent activity for peak rate calculation (last hour)
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const peakRate = await prisma.registration.count({
            where: { eventId: event.id, status: 'CHECKED_IN', updatedAt: { gte: hourAgo } }
        });

        const attendeesRaw = await prisma.registration.findMany({
            where: { eventId: event.id },
            include: { user: { select: { profile: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50 // reasonable limit for overview
        });

        const attendees = attendeesRaw.map(r => ({
            id: r.id,
            name: r.user.profile?.name || r.user.email.split('@')[0],
            email: r.user.email,
            status: r.status,
            ticketType: 'General', // placeholder, usually from custom fields
            regId: r.id.slice(0, 8).toUpperCase(),
            checkinTime: r.status === 'CHECKED_IN' ? r.updatedAt.toLocaleTimeString() : null
        }));

        res.json({
            totalRegistered,
            checkedIn,
            vipCount,
            peakRate,
            attendees
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});
router.get('/:id/live-activity', authenticate, requireAdmin, getLiveActivity);
router.post('/:id/reminders', authenticate, requireAdmin, sendEventReminder);

export default router;
