import { describe, expect, it } from 'vitest';
import { InMemorySettingStore } from './in-memory-setting-store.js';

describe('InMemorySettingStore', () => {
  it('reads typed values and falls back when missing', async () => {
    const settings = new InMemorySettingStore();
    await settings.set('security.max_login_attempts', 3);
    await settings.set('features.login', true);
    await settings.set('app.name', 'foundation');

    expect(await settings.getNumber('security.max_login_attempts', 5)).toBe(3);
    expect(await settings.getBoolean('features.login', false)).toBe(true);
    expect(await settings.getString('app.name', 'other')).toBe('foundation');
    expect(await settings.getNumber('missing', 9)).toBe(9);
  });
});
