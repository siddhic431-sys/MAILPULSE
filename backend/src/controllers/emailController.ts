import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { addEmailJob } from '../queues/emailQueue';
import { indexEmailDocument, searchEmails } from '../integrations/elasticsearch/indexer';
import { parseLeads } from '../utils/csvParser';
import { calculateDelayMs } from '../utils/time';
import { logger } from '../utils/logger';

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email()).min(1, 'At least one valid recipient is required'),
  senderId: z.string().uuid('Valid senderId required'),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  delayMs: z.coerce.number().min(0).default(2000),
  hourlyLimit: z.coerce.number().min(1).default(200),
});

export async function scheduleEmailsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { subject, body, recipients, senderId, startTime, delayMs, hourlyLimit } = req.body;

  try {
    // 1. Verify Sender belongs to current user
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      res.status(403).json({ success: false, error: 'Sender not found or does not belong to you' });
      return;
    }

    const startDate = new Date(startTime);
    const startTimestamp = isNaN(startDate.getTime()) ? Date.now() : startDate.getTime();

    // 2. Create Campaign record in PostgreSQL
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        senderId,
        subject,
        body,
        startTime: new Date(startTimestamp),
        delayMs: delayMs || 2000,
        hourlyLimit: hourlyLimit || 200,
      },
    });

    logger.info(
      `Creating email campaign [${campaign.id}] with ${recipients.length} emails, delayMs: ${delayMs}, hourlyLimit: ${hourlyLimit}`
    );

    const scheduledSummaries = [];

    // 3. Process each recipient sequentially to schedule staggered jobs
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      // Staggered scheduled time: startTime + (i * delayMs)
      const scheduledTime = new Date(startTimestamp + i * delayMs);
      const initialDelayMs = calculateDelayMs(scheduledTime);

      // Create Email record in PostgreSQL (source of truth)
      const email = await prisma.email.create({
        data: {
          campaignId: campaign.id,
          userId,
          senderId,
          recipient,
          subject,
          body,
          scheduledAt: scheduledTime,
          status: 'SCHEDULED',
        },
      });

      // Enqueue delayed job into BullMQ backed by Redis
      const job = await addEmailJob({
        emailId: email.id,
        campaignId: campaign.id,
        userId,
        senderId,
        delayMs: initialDelayMs,
      });

      // Persist the BullMQ job ID
      await prisma.email.update({
        where: { id: email.id },
        data: { bullmqJobId: job.id },
      });

      // Index initial email into Elasticsearch
      indexEmailDocument({
        id: email.id,
        userId,
        campaignId: campaign.id,
        sender: sender.email,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        createdAt: email.createdAt,
      }).catch((err) => {
        logger.warn(`Non-blocking ES index warning for email ${email.id}:`, { error: err.message });
      });

      scheduledSummaries.push({
        id: email.id,
        recipient: email.recipient,
        scheduledAt: scheduledTime,
        jobId: job.id,
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${recipients.length} emails.`,
      campaign: {
        id: campaign.id,
        subject: campaign.subject,
        totalEmails: recipients.length,
        firstScheduledAt: scheduledSummaries[0]?.scheduledAt,
        lastScheduledAt: scheduledSummaries[scheduledSummaries.length - 1]?.scheduledAt,
      },
      emails: scheduledSummaries,
    });
  } catch (error: any) {
    logger.error('Failed to schedule emails:', { error: error.message });
    res.status(500).json({ success: false, error: error.message || 'Failed to schedule emails' });
  }
}

export async function getScheduledEmailsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
  const search = (req.query.search as string)?.trim();

  const skip = (page - 1) * limit;

  try {
    const where: any = {
      userId,
      status: { in: ['SCHEDULED', 'PROCESSING'] },
    };

    if (search) {
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        include: { sender: { select: { email: true } } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve scheduled emails:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve scheduled emails' });
  }
}

export async function getSentEmailsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));
  const search = (req.query.search as string)?.trim();

  const skip = (page - 1) * limit;

  try {
    const where: any = {
      userId,
      status: { in: ['SENT', 'FAILED'] },
    };

    if (search) {
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        include: { sender: { select: { email: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve sent emails:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve sent emails' });
  }
}

export async function searchEmailsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const q = (req.query.q as string) || '';
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)));

  try {
    const results = await searchEmails({
      userId,
      query: q,
      page,
      limit,
    });

    res.json({
      success: true,
      ...results,
    });
  } catch (error: any) {
    logger.error('Elasticsearch search endpoint error:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to search emails' });
  }
}

export async function getEmailByIdHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const email = await prisma.email.findFirst({
      where: { id, userId },
      include: {
        sender: { select: { email: true } },
        campaign: true,
      },
    });

    if (!email) {
      res.status(404).json({ success: false, error: 'Email not found' });
      return;
    }

    res.json({ success: true, email });
  } catch (error: any) {
    logger.error('Failed to fetch email by ID:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch email' });
  }
}

export async function parseLeadsHandler(req: Request, res: Response): Promise<void> {
  try {
    let content = '';

    if (req.file) {
      content = req.file.buffer.toString('utf-8');
    } else if (req.body?.content) {
      content = String(req.body.content);
    }

    const result = parseLeads(content);
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to parse leads:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to parse leads' });
  }
}

export async function getEmailStatsHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const [scheduled, processing, sent, failed] = await Promise.all([
      prisma.email.count({ where: { userId, status: 'SCHEDULED' } }),
      prisma.email.count({ where: { userId, status: 'PROCESSING' } }),
      prisma.email.count({ where: { userId, status: 'SENT' } }),
      prisma.email.count({ where: { userId, status: 'FAILED' } }),
    ]);

    res.json({
      success: true,
      stats: {
        scheduled,
        processing,
        sent,
        failed,
        total: scheduled + processing + sent + failed,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get stats:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
  }
}
