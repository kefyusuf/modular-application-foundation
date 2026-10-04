import { z } from 'zod';

export const refreshSessionInput = z.object({ refresh_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
