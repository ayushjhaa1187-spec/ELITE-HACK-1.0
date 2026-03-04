import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
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
router.post('/:id/reminders', authenticate, requireAdmin, sendEventReminder);

export default router;
