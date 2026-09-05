import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getSlackConnectUrl, exchangeSlackCodeForToken } from '../integrations/slack/slackService';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { WebClient } from '@slack/web-api';

export async function getSlackConnectUrlHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const url = getSlackConnectUrl(userId);
    res.redirect(url);
  } catch (error: any) {
    logger.error('Failed to generate Slack connect URL:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to initiate Slack connection' });
  }
}

export async function slackCallbackHandler(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string;
  const userId = (req.query.state as string) || req.session?.userId;

  if (!code || !userId) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=missing_params`);
    return;
  }

  try {
    const { accessToken, teamId, channelId } = await exchangeSlackCodeForToken(code);

    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        accessToken,
        teamId,
        channelId,
      },
      create: {
        userId,
        accessToken,
        teamId,
        channelId,
      },
    });

    logger.info(`Slack successfully connected for user ${userId}`);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (error: any) {
    logger.error('Slack OAuth callback error:', { error: error.message });
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=oauth_failed`);
  }
}

export async function getSlackStatusHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: {
        id: true,
        teamId: true,
        channelId: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      isConnected: Boolean(connection),
      connection: connection || null,
    });
  } catch (error: any) {
    logger.error('Failed to get Slack status:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve Slack status' });
  }
}

export async function disconnectSlackHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    await prisma.slackConnection.deleteMany({
      where: { userId },
    });

    logger.info(`Slack disconnected for user ${userId}`);
    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (error: any) {
    logger.error('Failed to disconnect Slack:', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to disconnect Slack' });
  }
}

export async function testSlackNotificationHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      res.status(400).json({ success: false, error: 'Slack is not connected for this account' });
      return;
    }

    const slack = new WebClient(connection.accessToken);
    await slack.chat.postMessage({
      channel: connection.channelId,
      text: '🚀 *MailPulse Slack Integration Test*\nYour Slack workspace is successfully connected to MailPulse! Real-time alerts will be delivered here when hourly limits are reached.',
    });

    res.json({ success: true, message: 'Test message sent successfully to Slack' });
  } catch (error: any) {
    logger.error('Failed to send test Slack notification:', { error: error.message });
    res.status(500).json({ success: false, error: error.message || 'Failed to send Slack test message' });
  }
}

/**
 * Quick simulation for testing rate limit alerts without requiring real Slack OAuth client credentials
 */
export async function mockConnectSlackHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        teamId: 'T_DEMO_TEAM',
        channelId: 'C_DEMO_CHANNEL',
        accessToken: 'xoxb-demo-token',
      },
      create: {
        userId,
        teamId: 'T_DEMO_TEAM',
        channelId: 'C_DEMO_CHANNEL',
        accessToken: 'xoxb-demo-token',
      },
    });

    res.json({ success: true, message: 'Mock Slack workspace connected for demo' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
