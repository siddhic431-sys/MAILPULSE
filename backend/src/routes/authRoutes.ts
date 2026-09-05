import { Router } from 'express';
import {
  getGoogleAuthUrlHandler,
  googleCallbackHandler,
  getMeHandler,
  logoutHandler,
  devLoginHandler,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/google', getGoogleAuthUrlHandler);
router.get('/google/callback', googleCallbackHandler);
router.get('/me', requireAuth, getMeHandler);
router.post('/logout', logoutHandler);
router.post('/dev-login', devLoginHandler);

export default router;
