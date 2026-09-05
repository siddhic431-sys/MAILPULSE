import { Router } from 'express';
import {
  getSlackConnectUrlHandler,
  slackCallbackHandler,
  getSlackStatusHandler,
  disconnectSlackHandler,
  testSlackNotificationHandler,
  mockConnectSlackHandler,
} from '../controllers/slackController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public callback endpoint hit by Slack OAuth redirect
router.get('/callback', slackCallbackHandler);

// Protected endpoints
router.get('/connect', requireAuth, getSlackConnectUrlHandler);
router.get('/status', requireAuth, getSlackStatusHandler);
router.post('/disconnect', requireAuth, disconnectSlackHandler);
router.post('/test', requireAuth, testSlackNotificationHandler);
router.post('/mock-connect', requireAuth, mockConnectSlackHandler);

export default router;
