import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { sleep } from '../utils/time';
import { logger } from '../utils/logger';

const MIN_DELAY_LUA = `
local key = KEYS[1]
local minDelay = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local last = tonumber(redis.call('GET', key) or "0")

local targetTime = now
if (targetTime - last) < minDelay then
  targetTime = last + minDelay
end

redis.call('SET', key, targetTime, 'EX', 3600)
return targetTime - now
`;

/**
 * Ensures a minimum send delay between consecutive email sends across
 * all distributed worker processes and threads.
 *
 * Algorithm: Atomic Distributed Timeline Reservation
 * Each worker reserves a slot on the timeline. If the slot is in the future,
 * the worker sleeps until that slot arrives, guaranteeing minimum separation.
 */
export async function coordinateMinimumSendDelay(senderId?: string): Promise<number> {
  const minDelayMs = env.MIN_SEND_DELAY_MS;
  if (minDelayMs <= 0) return 0;

  // Key can be global or sender-scoped; using sender-scoped with fallback to global
  const key = senderId ? `mailpulse:min_delay:${senderId}` : 'mailpulse:min_delay:global';
  const now = Date.now();

  try {
    const sleepNeededMs: any = await redisClient.eval(MIN_DELAY_LUA, 1, key, minDelayMs, now);
    const delayDuration = Math.max(0, Number(sleepNeededMs));

    if (delayDuration > 0) {
      logger.debug(`Enforcing distributed send delay of ${delayDuration}ms for key [${key}]`);
      await sleep(delayDuration);
    }

    return delayDuration;
  } catch (error: any) {
    logger.warn('Error in Redis minimum send delay coordinator; falling back to local delay:', {
      error: error.message,
    });
    return 0;
  }
}
