import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import { checkInRegistration } from '../controllers/dashboardController';

const router = Router();

// Admin Routes for registrations
router.post('/:id/checkin', authenticate, requireAdmin, checkInRegistration);

export default router;
