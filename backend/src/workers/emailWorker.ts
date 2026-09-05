import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { EMAIL_QUEUE_NAME, addEmailJob } from '../queues/emailQueue';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { EmailJobData } from '../types';
import { checkAndIncrementHourlyRateLimit } from './rateLimiter';
import { coordinateMinimumSendDelay } from './minDelayCoordinator';
import { sendEmail } from '../integrations/smtp/etherealClient';
import { updateEmailDocumentStatus } from '../integrations/elasticsearch/indexer';
import { sendRateLimitNotification } from '../integrations/slack/slackService';
import { calculateDelayMs } from '../utils/time';

export function createEmailWorker(): Worker<EmailJobData> {
  const concurrency = env.WORKER_CONCURRENCY || 5;

  logger.info(`Initializing BullMQ Email Worker on queue [${EMAIL_QUEUE_NAME}] with concurrency ${concurrency}`);

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId } = job.data;
      logger.info(`Processing BullMQ Job [${job.id}] for Email ID [${emailId}]`);

      // 1. Fetch Email record from PostgreSQL
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: {
          sender: true,
          campaign: true,
          user: true,
        },
      });

      if (!email) {
        logger.warn(`Email record [${emailId}] not found in database. Discarding job.`);
        return;
      }

      // 2. Strict Idempotency check
      if (email.status === 'SENT') {
        logger.info(`Email [${emailId}] is already marked as SENT. Skipping redundant dispatch.`);
        return;
      }

      // 3. Atomic state claim: SCHEDULED / FAILED -> PROCESSING
      const claim = await prisma.email.updateMany({
        where: {
          id: emailId,
          status: { in: ['SCHEDULED', 'FAILED'] },
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (claim.count === 0) {
        logger.info(`Email [${emailId}] was not in SCHEDULED/FAILED state (claimed by another worker). Skipping.`);
        return;
      }

      // 4. Check Distributed Hourly Rate Limit
      const hourlyLimit = email.campaign?.hourlyLimit || env.MAX_EMAILS_PER_HOUR;
      const rateLimitCheck = await checkAndIncrementHourlyRateLimit({
        senderId: email.senderId,
        hourlyLimit,
      });

      if (!rateLimitCheck.allowed) {
        logger.warn(
          `Sender [${email.sender.email}] exceeded hourly rate limit of ${hourlyLimit} in window ${rateLimitCheck.hourWindow}. Rescheduling email [${emailId}]...`
        );

        const nextWindow = rateLimitCheck.nextHourStart;
        const rescheduleDelayMs = calculateDelayMs(nextWindow);

        // Update database: revert status to SCHEDULED, set scheduledAt to next window
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SCHEDULED',
            scheduledAt: nextWindow,
          },
        });

        // Enqueue delayed job for next window
        const rescheduledJob = await addEmailJob({
          emailId: email.id,
          campaignId: email.campaignId,
          userId: email.userId,
          senderId: email.senderId,
          delayMs: rescheduleDelayMs,
          jobIdOverride: `email:${email.id}:rescheduled:${nextWindow.getTime()}`,
        });

        await prisma.email.update({
          where: { id: emailId },
          data: { bullmqJobId: rescheduledJob.id },
        });

        // Send real Slack notification if Slack is connected for this user
        await sendRateLimitNotification({
          userId: email.userId,
          senderEmail: email.sender.email,
          hourlyLimit,
          hourWindow: rateLimitCheck.hourWindow,
          rescheduledTime: nextWindow,
        });

        return;
      }

      // 5. Distributed Minimum Send Delay Coordination
      await coordinateMinimumSendDelay(email.senderId);

      // 6. Send Email via Ethereal SMTP
      try {
        const sendResult = await sendEmail({
          from: email.sender.email,
          to: email.recipient,
          subject: email.subject,
          body: email.body,
          senderCredentials: {
            username: email.sender.etherealUsername,
            password: email.sender.etherealPassword,
          },
        });

        const sentAt = new Date();

        // 7. Update PostgreSQL state to SENT
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            messageId: sendResult.messageId,
            errorMessage: null,
          },
        });

        // 8. Update Elasticsearch document
        await updateEmailDocumentStatus({
          id: emailId,
          status: 'SENT',
          sentAt,
        });

        logger.info(`Email [${emailId}] successfully delivered to ${email.recipient}`);
      } catch (sendError: any) {
        logger.error(`Failed to send email [${emailId}]:`, { error: sendError.message });

        // Update status to FAILED in DB and Elasticsearch
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
          },
        });

        await updateEmailDocumentStatus({
          id: emailId,
          status: 'FAILED',
          errorMessage: sendError.message,
        });

        // Rethrow so BullMQ can trigger configured exponential backoff retry policy
        throw sendError;
      }
    },
    {
      connection: redisConfig,
      concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`BullMQ worker job failed for ${job?.id}:`, { error: err.message });
  });

  worker.on('error', (err) => {
    logger.error('BullMQ worker internal error:', { error: err.message });
  });

  return worker;
}
