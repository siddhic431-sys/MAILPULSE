import { Router } from 'express';
import authRoutes from './authRoutes';
import senderRoutes from './senderRoutes';
import emailRoutes from './emailRoutes';
import slackRoutes from './slackRoutes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mailpulse-api',
  });
});

router.use('/auth', authRoutes);
router.use('/senders', senderRoutes);
router.use('/emails', emailRoutes);
router.use('/slack', slackRoutes);

export default router;
