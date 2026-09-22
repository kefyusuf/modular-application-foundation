import { z } from 'zod';

export const loginInput = z.object({
  email: z.string().email(),
  passwordHash: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginInput>;
