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

export const bullRedisConfig: any = env.REDIS_URL
  ? (() => {
      try {
        const u = new URL(env.REDIS_URL);
        return {
          host: u.hostname,
          port: parseInt(u.port, 10) || 6379,
          username: u.username || undefined,
          password: u.password || undefined,
          tls: u.protocol === 'rediss:' ? {} : undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        };
      } catch {
        return redisConfig;
      }
    })()
  : redisConfig;

export function createRedisClient(name: string = 'app'): Redis {
  const client = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
          return Math.min(times * 200, 2000);
        },
      })
    : new Redis(redisConfig);

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
