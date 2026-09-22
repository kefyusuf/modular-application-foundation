export interface SettingReader {
  getBoolean(key: string, fallback: boolean): Promise<boolean>;
  getNumber(key: string, fallback: number): Promise<number>;
  getString(key: string, fallback: string): Promise<string>;
}

export interface SettingWriter {
  set(key: string, value: boolean | number | string): Promise<void>;
}
