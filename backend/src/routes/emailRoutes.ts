import { Router } from 'express';
import multer from 'multer';
import {
  scheduleEmailsHandler,
  getScheduledEmailsHandler,
  getSentEmailsHandler,
  searchEmailsHandler,
  getEmailByIdHandler,
  parseLeadsHandler,
  getEmailStatsHandler,
  scheduleEmailSchema,
} from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

router.use(requireAuth);

router.post('/schedule', validateBody(scheduleEmailSchema), scheduleEmailsHandler);
router.get('/scheduled', getScheduledEmailsHandler);
router.get('/sent', getSentEmailsHandler);
router.get('/search', searchEmailsHandler);
router.get('/stats', getEmailStatsHandler);
router.post('/parse-leads', upload.single('file'), parseLeadsHandler);
router.get('/:id', getEmailByIdHandler);

export default router;
