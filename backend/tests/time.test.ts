import { getHourWindowString, getNextHourStart, calculateDelayMs } from '../src/utils/time';

describe('Time and Window Utilities', () => {
  it('should format UTC hour window string correctly', () => {
    const testDate = new Date('2026-09-05T14:35:22.000Z');
    const window = getHourWindowString(testDate);
    expect(window).toBe('2026-09-05-14');
  });

  it('should calculate the start of next hour window correctly', () => {
    const testDate = new Date('2026-09-05T14:35:22.000Z');
    const nextHour = getNextHourStart(testDate);
    expect(nextHour.toISOString()).toBe('2026-09-05T15:00:00.000Z');
  });

  it('should calculate delayMs correctly for future dates', () => {
    const now = Date.now();
    const futureDate = new Date(now + 5000);
    const delay = calculateDelayMs(futureDate);
    expect(delay).toBeGreaterThanOrEqual(4500);
    expect(delay).toBeLessThanOrEqual(5100);
  });

  it('should return 0 delay for past dates', () => {
    const pastDate = new Date(Date.now() - 10000);
    const delay = calculateDelayMs(pastDate);
    expect(delay).toBe(0);
  });
});
