import { Queue, QueueEvents, JobsOptions } from 'bullmq';
import { redisConfig } from '../config/redis';
import { EmailJobData } from '../types';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'mailpulse-email-sending';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
});

emailQueue.on('error', (err) => {
  logger.warn(`BullMQ emailQueue connection warning: ${err.message}`);
});

emailQueueEvents.on('error', (err) => {
  logger.warn(`BullMQ emailQueueEvents connection warning: ${err.message}`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.warn(`BullMQ Job [${jobId}] failed: ${failedReason}`);
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.debug(`BullMQ Job [${jobId}] completed successfully`);
});

export async function addEmailJob({
  emailId,
  campaignId,
  userId,
  senderId,
  delayMs,
  jobIdOverride,
}: {
  emailId: string;
  campaignId: string;
  userId: string;
  senderId: string;
  delayMs: number;
  jobIdOverride?: string;
}) {
  const deterministicJobId = jobIdOverride || `email:${emailId}`;

  const options: JobsOptions = {
    jobId: deterministicJobId,
    delay: Math.max(0, Math.floor(delayMs)),
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  };

  const job = await emailQueue.add(
    'send-email',
    {
      emailId,
      campaignId,
      userId,
      senderId,
    },
    options
  );

  logger.info(`Enqueued BullMQ delayed job [${job.id}] with delay ${options.delay}ms for email ${emailId}`);
  return job;
}
