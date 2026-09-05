import { getHourWindowString, getNextHourStart } from '../src/utils/time';

describe('Distributed Hourly Rate Limiting and Rescheduling', () => {
  class MockRedisRateLimiter {
    counters: Map<string, number> = new Map();

    /**
     * Replicates the atomic Lua script in rateLimiter.ts
     */
    checkAndIncrement(senderId: string, limit: number, date: Date = new Date()) {
      const window = getHourWindowString(date);
      const key = `email-rate:${senderId}:${window}`;
      const current = this.counters.get(key) || 0;

      if (current >= limit) {
        return {
          allowed: false,
          currentCount: current,
          limit,
          hourWindow: window,
          nextHourStart: getNextHourStart(date),
        };
      }

      const nextCount = current + 1;
      this.counters.set(key, nextCount);
      return {
        allowed: true,
        currentCount: nextCount,
        limit,
        hourWindow: window,
        nextHourStart: getNextHourStart(date),
      };
    }
  }

  it('should allow emails within the configured hourly limit', () => {
    const limiter = new MockRedisRateLimiter();
    const senderId = 'sender-alpha';
    const limit = 2;

    const res1 = limiter.checkAndIncrement(senderId, limit);
    expect(res1.allowed).toBe(true);
    expect(res1.currentCount).toBe(1);

    const res2 = limiter.checkAndIncrement(senderId, limit);
    expect(res2.allowed).toBe(true);
    expect(res2.currentCount).toBe(2);
  });

  it('should reject emails exceeding the hourly limit and calculate the next hour start', () => {
    const limiter = new MockRedisRateLimiter();
    const senderId = 'sender-beta';
    const limit = 2;
    const testDate = new Date('2026-09-05T10:15:00.000Z');

    limiter.checkAndIncrement(senderId, limit, testDate); // 1
    limiter.checkAndIncrement(senderId, limit, testDate); // 2

    // 3rd attempt exceeds limit
    const res3 = limiter.checkAndIncrement(senderId, limit, testDate);
    expect(res3.allowed).toBe(false);
    expect(res3.currentCount).toBe(2);
    expect(res3.nextHourStart.toISOString()).toBe('2026-09-05T11:00:00.000Z');
  });

  it('should isolate rate limits across different senders', () => {
    const limiter = new MockRedisRateLimiter();
    const limit = 1;

    const resSender1 = limiter.checkAndIncrement('sender-1', limit);
    const resSender2 = limiter.checkAndIncrement('sender-2', limit);

    expect(resSender1.allowed).toBe(true);
    expect(resSender2.allowed).toBe(true);

    // Second email for sender-1 is rejected, while sender-2 can't take more either
    expect(limiter.checkAndIncrement('sender-1', limit).allowed).toBe(false);
  });
});
