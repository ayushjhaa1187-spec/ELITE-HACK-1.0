import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { getUserRegistrations } from '../controllers/registrationController';
import { getNotifications } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Simple in-memory rate limiting for auth
const authAttempts = new Map<string, number>();
const throttle = (req: any, res: any, next: any) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const lastAt = authAttempts.get(ip) || 0;
    if (now - lastAt < 1000) { // 1 request per second
        return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }
    authAttempts.set(ip, now);
    next();
};

router.post('/register', throttle, register);
router.post('/login', throttle, login);
router.get('/me', authenticate, getMe);
router.get('/me/registrations', authenticate, getUserRegistrations);
router.get('/me/notifications', authenticate, getNotifications);

export default router;
