import { Router } from 'express';
import { getSendersHandler, createSenderHandler } from '../controllers/senderController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', getSendersHandler);
router.post('/', createSenderHandler);

export default router;
