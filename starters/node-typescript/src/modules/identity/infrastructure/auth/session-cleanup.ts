export function validateSessionCleanup(now: number, limit: number): void {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('Invalid session cleanup parameters');
  }
}
