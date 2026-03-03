import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { getUserRegistrations } from '../controllers/registrationController';
import { getNotifications } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/me/registrations', authenticate, getUserRegistrations);
router.get('/me/notifications', authenticate, getNotifications);

export default router;
