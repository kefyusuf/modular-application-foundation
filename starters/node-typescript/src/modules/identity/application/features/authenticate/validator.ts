import { z } from 'zod';

export const authenticateInput = z.object({ email: z.string().email(), password: z.string().max(1024) }).strict();
