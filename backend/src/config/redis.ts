import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
};

export function createRedisClient(name: string = 'app'): Redis {
  const client = new Redis(redisConfig);

  client.on('connect', () => {
    logger.info(`Redis [${name}] connected successfully`);
  });

  client.on('error', (err) => {
    logger.error(`Redis [${name}] error:`, { error: err.message });
  });

  return client;
}

// Default singleton Redis instance for general app use (rate-limiting, locks, sessions)
export const redisClient = createRedisClient('default');
