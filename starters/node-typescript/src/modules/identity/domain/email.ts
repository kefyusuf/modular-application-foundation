export class Email {
  private constructor(public readonly value: string) {}

  static from(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error('Invalid email');
    }
    return new Email(value);
  }
}
