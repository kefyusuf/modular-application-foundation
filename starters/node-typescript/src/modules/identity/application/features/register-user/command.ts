export class RegisterUserCommand {
  constructor(
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly userId: string,
  ) {}
}
