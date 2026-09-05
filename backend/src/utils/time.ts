/**
 * Returns the UTC hour window string in format: YYYY-MM-DD-HH
 * e.g., "2026-09-05-12"
 */
export function getHourWindowString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}`;
}

/**
 * Calculates the exact Date at the start of the next UTC hour window.
 * E.g., if now is 10:14:32, next hour start is 11:00:00.000
 */
export function getNextHourStart(date: Date = new Date()): Date {
  const next = new Date(date.getTime());
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
}

/**
 * Computes delay in milliseconds from now until targetDate.
 * If targetDate is in the past, returns 0.
 */
export function calculateDelayMs(targetDate: Date | string | number): number {
  const targetTime = new Date(targetDate).getTime();
  const now = Date.now();
  return Math.max(0, targetTime - now);
}

/**
 * Asynchronous sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
