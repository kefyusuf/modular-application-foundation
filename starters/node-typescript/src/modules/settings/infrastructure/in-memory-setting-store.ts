import type { SettingReader, SettingWriter } from '../public/setting-contracts.js';

export class InMemorySettingStore implements SettingReader, SettingWriter {
  private readonly values = new Map<string, boolean | number | string>();

  async getBoolean(key: string, fallback: boolean): Promise<boolean> {
    const value = this.values.get(key);
    return typeof value === 'boolean' ? value : fallback;
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : fallback;
  }

  async getString(key: string, fallback: string): Promise<string> {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : fallback;
  }

  async set(key: string, value: boolean | number | string): Promise<void> {
    this.values.set(key, value);
  }
}
