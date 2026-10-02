import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CommandBus } from '../kernel/ports.js';
import { writeProblem } from './problem.js';
import { LoginCommand } from '../modules/identity/application/features/login/command.js';
import { loginInput } from '../modules/identity/application/features/login/validator.js';
import { RegisterUserCommand } from '../modules/identity/application/features/register-user/command.js';
import { ensureCanCreateUser } from '../modules/identity/application/features/register-user/policy.js';
import { registerUserInput, registerPasswordInput } from '../modules/identity/application/features/register-user/validator.js';
import { actorFromRequest } from './actor.js';
import type { PolicyEvaluator } from '../kernel/ports.js';
import { randomUUID } from 'node:crypto';
import { AuthenticateCommand } from '../modules/identity/application/features/authenticate/command.js';
import { authenticateInput } from '../modules/identity/application/features/authenticate/validator.js';
import { CurrentUserCommand } from '../modules/identity/application/features/current-user/command.js';
import { requestContext, type RequestMetadata, type RequestContextStore } from './request-context.js';
import { RefreshSessionCommand } from '../modules/identity/application/features/refresh-session/command.js';
import { refreshSessionInput } from '../modules/identity/application/features/refresh-session/validator.js';
import { LogoutCommand } from '../modules/identity/application/features/logout/command.js';

export function createHttpHandler(deps: {
  commandBus: CommandBus;
  policyEvaluator: PolicyEvaluator;
  contexts?: RequestContextStore;
}) {
  const handle = async (req: IncomingMessage, res: ServerResponse, meta: RequestMetadata): Promise<void> => {
    const problem = (status: number, title: string, detail?: string) => {
      if (status === 401) res.setHeader('www-authenticate', 'Bearer');
      writeProblem(res, status, title, detail, { ...meta, instance: req.url });
    };
    const authFailure = (error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Invalid credentials') problem(401, 'Unauthorized');
      else if (message === 'Forbidden') problem(403, 'Forbidden');
      else if (message === 'Too many attempts') problem(429, 'Too many requests');
      else if (message === 'Invalid JSON body') problem(400, 'Invalid request');
      else problem(500, 'Internal server error');
    };

    if (req.method === 'POST' && req.url === '/api/v1/identity/auth/login') {
      try {
        const parsed = authenticateInput.safeParse(await readJson(req));
        if (!parsed.success) {
          problem(400, 'Invalid request', parsed.error.message);
          return;
        }
        const data = await deps.commandBus.dispatch(new AuthenticateCommand(parsed.data.email, parsed.data.password));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ data, meta }));
      } catch (error) { authFailure(error); }
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/identity/auth/refresh') {
      try {
        const parsed = refreshSessionInput.safeParse(await readJson(req));
        if (!parsed.success) {
          problem(400, 'Invalid request');
          return;
        }
        const data = await deps.commandBus.dispatch(new RefreshSessionCommand(parsed.data.refresh_token));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ data, meta }));
      } catch (error) { authFailure(error); }
      return;
    }

    const logout = req.method === 'POST' && req.url === '/api/v1/identity/auth/logout';
    if (logout || (req.method === 'GET' && req.url === '/api/v1/identity/me')) {
      try {
        const authorization = req.headers.authorization;
        const match = typeof authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(authorization) : null;
        if (!match) {
          problem(401, 'Unauthorized');
          return;
        }
        if (logout) {
          await deps.commandBus.dispatch(new LogoutCommand(match[1]));
          res.writeHead(204, { 'cache-control': 'no-store' });
          res.end();
          return;
        }
        const data = await deps.commandBus.dispatch(new CurrentUserCommand(match[1]));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ data, meta }));
      } catch (error) { authFailure(error); }
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/identity/users') {
      try {
        const body = await readJson(req);
        const standard = typeof body === 'object' && body !== null && 'password' in body;
        const parsed = standard ? registerPasswordInput.safeParse(body) : registerUserInput.safeParse(body);
        if (!parsed.success) {
          problem(400, 'Invalid request', parsed.error.message);
          return;
        }

        const actor = actorFromRequest(req);
        await ensureCanCreateUser(deps.policyEvaluator, actor);

        const result = await deps.commandBus.dispatch(
          new RegisterUserCommand(parsed.data.email, 'password' in parsed.data ? parsed.data.password : parsed.data.passwordHash, randomUUID(), standard ? 'password' : 'passwordHash'),
        );

        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        if (message === 'Forbidden') {
          problem(403, 'Forbidden');
          return;
        }
        if (message === 'Email already used' || message === 'Concurrency conflict') {
          problem(409, 'Conflict');
          return;
        }
        problem(400, 'Request failed', message);
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/api/v1/identity/login') {
      try {
        const body = await readJson(req);
        const parsed = loginInput.safeParse(body);
        if (!parsed.success) {
          problem(400, 'Invalid request', parsed.error.message);
          return;
        }

        const result = await deps.commandBus.dispatch(
          new LoginCommand(parsed.data.email, parsed.data.passwordHash),
        );

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        if (message === 'Invalid credentials') {
          problem(401, 'Unauthorized', message);
          return;
        }
        if (message === 'Too many attempts') {
          problem(429, 'Too many requests', message);
          return;
        }
        problem(400, 'Request failed', message);
      }
      return;
    }

    problem(404, 'Not found');
  };
  return (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const meta = requestContext(req, res);
    const action = () => handle(req, res, meta);
    return deps.contexts ? deps.contexts.run({ requestId: meta.request_id, correlationId: meta.correlation_id }, action) : action();
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
  try { return JSON.parse(raw) as unknown; } catch { throw new Error('Invalid JSON body'); }
}
