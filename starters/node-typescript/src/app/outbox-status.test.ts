import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); });

it('requires an explicitly configured database before reading outbox status', async () => {
  vi.stubEnv('DATABASE_URL', '');
  await expect(import('./outbox-status.js')).rejects.toThrow('DATABASE_URL is required to read outbox status');
});
