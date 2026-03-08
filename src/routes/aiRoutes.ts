import { Router } from 'express';
import { generateBroadcast, generateEventReport } from '../controllers/aiController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Secure these routes as they cost tokens/API quota
router.post('/broadcast/generate', authenticate, generateBroadcast);
router.post('/report/generate', authenticate, generateEventReport);

export default router;
