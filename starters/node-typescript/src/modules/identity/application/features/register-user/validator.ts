import { z } from 'zod';

export const registerUserInput = z.object({
  email: z.string().email(),
  passwordHash: z.string().min(8),
});

export type RegisterUserInput = z.infer<typeof registerUserInput>;
