import { z } from 'zod';

export const registerUserInput = z.object({
  email: z.string().email(),
  passwordHash: z.string().min(8),
});

export type RegisterUserInput = z.infer<typeof registerUserInput>;

export const registerPasswordInput = z.object({ email: z.string().email(), password: z.string().min(8).max(1024) }).strict();
