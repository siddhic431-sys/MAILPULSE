import { WebClient } from '@slack/web-api';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

export function getSlackConnectUrl(userId: string): string {
  const scopes = ['chat:write', 'channels:read', 'groups:read', 'chat:write.public'];
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: scopes.join(','),
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: userId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCodeForToken(code: string): Promise<{
  accessToken: string;
  teamId: string;
  teamName?: string;
  channelId: string;
}> {
  const client = new WebClient();

  const response: any = await client.oauth.v2.access({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  if (!response.ok || !response.access_token) {
    throw new Error(`Slack OAuth token exchange failed: ${response.error || 'Unknown error'}`);
  }

  const accessToken = response.access_token;
  const teamId = response.team?.id || 'unknown-team';
  const teamName = response.team?.name;

  // Determine channel to post in (either incoming webhook channel, or fallback to first public channel like #general)
  let channelId = response.incoming_webhook?.channel_id;

  if (!channelId) {
    try {
      const userClient = new WebClient(accessToken);
      const list = await userClient.conversations.list({ types: 'public_channel', limit: 5 });
      const defaultChannel = list.channels?.find((c) => c.is_general) || list.channels?.[0];
      if (defaultChannel?.id) {
        channelId = defaultChannel.id;
      }
    } catch (err: any) {
      logger.warn('Failed to autodetect public Slack channel:', { error: err.message });
      channelId = 'general';
    }
  }

  return {
    accessToken,
    teamId,
    teamName,
    channelId: channelId || 'general',
  };
}

export async function sendRateLimitNotification({
  userId,
  senderEmail,
  hourlyLimit,
  hourWindow,
  rescheduledTime,
}: {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  hourWindow: string;
  rescheduledTime: Date;
}): Promise<boolean> {
  // Idempotency guard: prevent duplicate Slack notifications for the same sender and hour window
  const dedupeKey = `email-rate:slack-notified:${senderEmail}:${hourWindow}`;
  const acquired = await redisClient.set(dedupeKey, '1', 'EX', 3600, 'NX');

  if (!acquired) {
    logger.info(`Slack alert already dispatched for ${senderEmail} in window ${hourWindow}. Skipping duplicate alert.`);
    return false;
  }

  // Lookup user's Slack connection
  const connection = await prisma.slackConnection.findUnique({
    where: { userId },
  });

  if (!connection || !connection.accessToken) {
    logger.info(`No Slack connection found for user ${userId}. Skipping Slack notification gracefully.`);
    return false;
  }

  const messageText = `⚠️ *MailPulse Rate Limit Alert*\nRate limit reached for sender \`${senderEmail}\`. The hourly limit of *${hourlyLimit} emails* has been reached for window \`${hourWindow}\`. Remaining queued emails have been safely rescheduled to the next available window starting at *${rescheduledTime.toUTCString()}*.`;

  try {
    const slack = new WebClient(connection.accessToken);
    await slack.chat.postMessage({
      channel: connection.channelId,
      text: messageText,
    });

    logger.info(`Slack rate-limit alert successfully sent to channel ${connection.channelId} for sender ${senderEmail}`);
    return true;
  } catch (error: any) {
    logger.error('Failed to dispatch Slack rate-limit message:', {
      error: error.message,
      channel: connection.channelId,
    });
    return false;
  }
}
