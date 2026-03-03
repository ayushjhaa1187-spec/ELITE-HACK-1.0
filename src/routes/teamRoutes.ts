import { Router } from 'express';
import { joinTeam } from '../controllers/registrationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/join', authenticate, joinTeam);

export default router;
