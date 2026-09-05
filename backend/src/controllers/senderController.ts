import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createEtherealAccount } from '../integrations/smtp/etherealClient';
import { logger } from '../utils/logger';

export async function getSendersHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    let senders = await prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        etherealUsername: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (senders.length === 0) {
      try {
        const ethereal = await createEtherealAccount();
        const newSender = await prisma.sender.create({
          data: {
            userId,
            email: ethereal.email,
            etherealUsername: ethereal.user,
            etherealPassword: ethereal.pass,
          },
          select: {
            id: true,
            email: true,
            etherealUsername: true,
            createdAt: true,
          },
        });
        senders = [newSender];
      } catch (e: any) {
        logger.warn('Could not auto-provision Ethereal sender in getSendersHandler:', { error: e.message });
      }
    }

    res.json({
      success: true,
      senders,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve senders:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve senders' });
  }
}

export async function createSenderHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const ethereal = await createEtherealAccount();

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: ethereal.email,
        etherealUsername: ethereal.user,
        etherealPassword: ethereal.pass,
      },
    });

    logger.info(`New Ethereal sender created for user ${userId}: ${sender.email}`);

    res.status(201).json({
      success: true,
      sender: {
        id: sender.id,
        email: sender.email,
        etherealUsername: sender.etherealUsername,
        createdAt: sender.createdAt,
      },
    });
  } catch (error: any) {
    logger.error('Failed to create new sender:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to provision sender' });
  }
}
