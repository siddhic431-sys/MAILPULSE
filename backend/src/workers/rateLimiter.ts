import { redisClient } from '../config/redis';
import { getHourWindowString, getNextHourStart } from '../utils/time';
import { env } from '../config/env';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourWindow: string;
  nextHourStart: Date;
}

const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key) or "0")

if current >= limit then
  return { 0, current }
else
  local newCount = redis.call('INCR', key)
  if newCount == 1 then
    redis.call('EXPIRE', key, 7200)
  end
  return { 1, newCount }
end
`;

/**
 * Checks and atomically claims an hourly quota slot for the given sender.
 * Works seamlessly across distributed workers and cluster nodes.
 */
export async function checkAndIncrementHourlyRateLimit({
  senderId,
  hourlyLimit,
  date = new Date(),
}: {
  senderId: string;
  hourlyLimit?: number;
  date?: Date;
}): Promise<RateLimitCheckResult> {
  const limit = hourlyLimit && hourlyLimit > 0 ? hourlyLimit : env.MAX_EMAILS_PER_HOUR;
  const hourWindow = getHourWindowString(date);
  const redisKey = `email-rate:${senderId}:${hourWindow}`;

  // Execute atomic Lua script
  const result: any = await redisClient.eval(RATE_LIMIT_LUA, 1, redisKey, limit);
  const allowed = result[0] === 1;
  const currentCount = Number(result[1]);
  const nextHourStart = getNextHourStart(date);

  return {
    allowed,
    currentCount,
    limit,
    hourWindow,
    nextHourStart,
  };
}
