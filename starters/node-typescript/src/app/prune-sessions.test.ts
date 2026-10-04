import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); });

it('refuses session maintenance without an explicitly configured database', async () => {
  vi.stubEnv('DATABASE_URL', '');
  await expect(import('./prune-sessions.js')).rejects.toThrow('DATABASE_URL is required to prune expired sessions');
});
