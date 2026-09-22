import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { CommandBus, PolicyEvaluator } from '../kernel/ports.js';
import { actorFromRequest } from './actor.js';
import { writeProblem } from './problem.js';
import { RegisterUserCommand } from '../modules/identity/application/features/register-user/command.js';
import { ensureCanCreateUser } from '../modules/identity/application/features/register-user/policy.js';
import { registerUserInput } from '../modules/identity/application/features/register-user/validator.js';

export function createHttpHandler(deps: {
  commandBus: CommandBus;
  policyEvaluator: PolicyEvaluator;
}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/identity/users') {
      try {
        const body = await readJson(req);
        const parsed = registerUserInput.safeParse(body);
        if (!parsed.success) {
          writeProblem(res, 400, 'Invalid request', parsed.error.message);
          return;
        }

        const actor = actorFromRequest(req);
        await ensureCanCreateUser(deps.policyEvaluator, actor);

        const result = await deps.commandBus.dispatch(
          new RegisterUserCommand(parsed.data.email, parsed.data.passwordHash, randomUUID()),
        );

        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        if (message === 'Forbidden') {
          writeProblem(res, 403, 'Forbidden');
          return;
        }
        writeProblem(res, 400, 'Request failed', message);
      }
      return;
    }

    writeProblem(res, 404, 'Not found');
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}
