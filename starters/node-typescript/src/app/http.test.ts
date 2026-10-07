import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApplication } from './application.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import { randomBytes } from 'node:crypto';

type Operation = { operationId: string; responses: Record<string, { content: Record<string, { schema: object }> }> };
const contract = parse(readFileSync(new URL('../../../../contracts/openapi/public-api.v1.yml', import.meta.url), 'utf8')) as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, object> };
};
const ajv = new Ajv2020({ strict: false, allErrors: true });
for (const [name, format] of Object.entries(fullFormats)) ajv.addFormat(name, format);
ajv.addFormat('password', true);
const schemas = JSON.parse(JSON.stringify(contract.components.schemas).replaceAll('#/components/schemas/', '#/$defs/'));
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
function contractOperation(operationId: string) {
  for (const [route, methods] of Object.entries(contract.paths)) {
    for (const operation of Object.values(methods)) if (operation.operationId === operationId) return { route: `/api/v1${route}`, operation };
  }
  throw new Error(`Contract operation missing: ${operationId}`);
}

async function expectContract(response: Response, operationId: string, status: number) {
  expect(response.status).toBe(status);
  if (status === 204) {
    expect(contractOperation(operationId).operation.responses[String(status)]).toBeDefined();
    expect(await response.text()).toBe('');
    expect(response.headers.get('cache-control')).toBe('no-store');
    return null;
  }
  const mediaType = status === 200 ? 'application/json' : 'application/problem+json';
  expect(response.headers.get('content-type')).toBe(mediaType);
  if (status === 401) expect(response.headers.get('www-authenticate')).toBe('Bearer');
  const schema = contractOperation(operationId).operation.responses[String(status)].content[mediaType].schema;
  const key = `${operationId}:${status}`;
  if (!validators.has(key)) {
    const mapped = JSON.parse(JSON.stringify(schema).replaceAll('#/components/schemas/', '#/$defs/'));
    validators.set(key, ajv.compile({ $defs: schemas, ...mapped }));
  }
  const validate = validators.get(key)!;
  const body = await response.json();
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  return body;
}

describe('HTTP adapter with real module wiring', () => {
  let app: Awaited<ReturnType<typeof createApplication>>;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    app = await createApplication();
    server = createServer((req, res) => { void app.handler(req, res); });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });

  function post(path: string, body: unknown, roles?: string) {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(roles ? { 'x-actor-id': 'demo', 'x-actor-roles': roles } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('rejects oversized registration JSON with a sanitized 413 response', async () => {
    const response = await post('/api/v1/identity/users', {
      email: 'oversized@example.com', passwordHash: 'x'.repeat(65536),
    }, 'admin');
    expect(response.status).toBe(413);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    const problem = await response.json();
    expect(problem).toMatchObject({ status: 413, title: 'Content too large' });
    expect(problem).not.toHaveProperty('detail');
    expect(problem.request_id).toBe(response.headers.get('x-request-id'));
  });

  it('accepts valid registration JSON at exactly 65536 bytes', async () => {
    const json = JSON.stringify({ email: 'at-limit@example.com', password: 'a-long-password' });
    const response = await fetch(`${baseUrl}/api/v1/identity/users`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin' },
      body: json.padEnd(65536, ' '),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ email: 'at-limit@example.com' });
  });

  it.each([
    ['/api/v1/identity/login', undefined],
    ['/api/v1/identity/auth/login', 'login'],
    ['/api/v1/identity/auth/refresh', 'refreshSession'],
  ])('rejects oversized JSON before validating fields at %s', async (path, operation) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'.padEnd(65537, ' '),
    });
    if (operation) await expectContract(response, operation, 413);
    else {
      expect(response.status).toBe(413);
      expect(await response.json()).toMatchObject({ status: 413, title: 'Content too large' });
    }
  });

  it('counts UTF-8 bytes rather than string characters for the body limit', async () => {
    const response = await post('/api/v1/identity/users', {
      email: 'unicode-limit@example.com', passwordHash: 'é'.repeat(40000),
    }, 'admin');
    expect(response.status).toBe(413);
    await response.json();
  });

  it('returns 413 for an oversized chunked body without a Content-Length header', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(`${baseUrl}/api/v1/identity/users`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin' },
      }, (res) => {
        res.resume();
        res.once('end', () => resolve(res.statusCode!));
        res.once('error', reject);
      });
      req.once('error', reject);
      req.setTimeout(3000, () => req.destroy(new Error('Chunked response timeout')));
      req.write('{}');
      req.write(' '.repeat(32767));
      req.end(' '.repeat(32768));
    });
    expect(status).toBe(413);
  });

  it.each([
    ['/api/v1/identity/users', { email: 'failure@example.com', password: 'a-long-password' }, 'save'],
    ['/api/v1/identity/users', { email: 'failure@example.com', passwordHash: 'legacy-password-hash' }, 'save'],
    ['/api/v1/identity/login', { email: 'failure@example.com', passwordHash: 'legacy-password-hash' }, 'findByEmail'],
  ] as const)('sanitizes unexpected persistence failures for %s', async (path, body, operation) => {
    const internalMessage = 'database connection failed: private-db.example:5432; internal query';
    vi.spyOn(app.users, operation).mockRejectedValueOnce(new Error(internalMessage));

    const response = await post(path, body, 'admin');
    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    const problem = await response.json();
    expect(problem).toMatchObject({ status: 500, title: 'Internal server error', instance: path });
    expect(problem).not.toHaveProperty('detail');
    expect(JSON.stringify(problem)).not.toContain(internalMessage);
    expect(problem.request_id).toBe(response.headers.get('x-request-id'));
    expect(problem.correlation_id).toBe(response.headers.get('x-correlation-id'));
  });

  it('carries HTTP request context into the registration audit entry', async () => {
    const response = await fetch(`${baseUrl}/api/v1/identity/users`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin', 'x-request-id': 'request-register', 'x-correlation-id': 'workflow-register' },
      body: JSON.stringify({ email: 'context@example.com', password: 'a-long-password' }),
    });
    expect(response.status).toBe(201);
    await response.json();
    const entries = await app.audit.list();
    expect(entries[0]).toMatchObject({ context: { requestId: 'request-register', correlationId: 'workflow-register' } });
  });

  it('keeps event context isolated for overlapping HTTP requests', async () => {
    const emails = ['first-context@example.com', 'second-context@example.com'];
    const responses = await Promise.all(emails.map((email, index) => fetch(`${baseUrl}/api/v1/identity/users`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin', 'x-request-id': `request-${index}`, 'x-correlation-id': `workflow-${index}` },
      body: JSON.stringify({ email, password: 'a-long-password' }),
    })));
    for (const response of responses) { expect(response.status).toBe(201); await response.json(); }
    const entries = await app.audit.list();
    emails.forEach((email, index) => expect(entries.find((entry) => entry.data.email === email)).toMatchObject({ context: { requestId: `request-${index}`, correlationId: `workflow-${index}` } }));
  });

  it('uses normalized generated IDs without inheriting a prior request context', async () => {
    for (const [email, requestId, correlationId] of [
      ['prior-context@example.com', 'prior-request', 'prior-workflow'],
      ['generated-context@example.com', 'invalid id', undefined],
    ]) {
      const response = await fetch(`${baseUrl}/api/v1/identity/users`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin', 'x-request-id': requestId!, ...(correlationId ? { 'x-correlation-id': correlationId } : {}) },
        body: JSON.stringify({ email, password: 'a-long-password' }),
      });
      expect(response.status).toBe(201);
      await response.json();
      if (email === 'generated-context@example.com') {
        const normalizedId = response.headers.get('x-request-id');
        expect(normalizedId).toMatch(/^[0-9a-f-]{36}$/);
        expect(response.headers.get('x-correlation-id')).toBe(normalizedId);
        const entry = (await app.audit.list()).find((entry) => entry.data.email === email);
        expect(entry).toMatchObject({ context: { requestId: normalizedId, correlationId: normalizedId } });
      }
    }
  });

  async function expectProblem(response: Response, status: number) {
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ type: 'about:blank', status, title: expect.any(String) });
  }

  const credentials = { email: 'User@Example.com', passwordHash: 'password-hash' };

  it('serves health and returns Problem Details for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    await expectProblem(await fetch(`${baseUrl}/missing`), 404);
  });

  it('registers through the command bus, triggers subscribers, then logs in', async () => {
    const registered = await post('/api/v1/identity/users', credentials, 'admin');
    expect(registered.status).toBe(201);
    expect(registered.headers.get('content-type')).toBe('application/json');
    const user = await registered.json() as { userId: string; email: string };
    expect(user).toEqual({ userId: expect.any(String), email: 'user@example.com' });
    expect((await app.audit.list())).toHaveLength(1);
    expect((await app.audit.list())[0]).toMatchObject({ action: 'identity.user.registered', subject: user.userId });
    expect((await app.notifications.list())).toHaveLength(1);
    expect((await app.notifications.list())[0]).toMatchObject({ channel: 'email', to: user.email });

    const login = await post('/api/v1/identity/login', credentials);
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ ...user, token: `token.${user.userId}` });
    expect(app.eventLog.some((entry) => entry.startsWith('identity.user.login_succeeded.v1 '))).toBe(true);
    expect((await app.audit.list())).toHaveLength(1);
    expect((await app.notifications.list())).toHaveLength(1);
  });

  it.each([undefined, 'user'])('denies registration for role %s without side effects', async (roles) => {
    await expectProblem(await post('/api/v1/identity/users', credentials, roles), 403);
    expect(await app.users.findByEmail(credentials.email)).toBeNull();
    expect(app.eventLog).toEqual([]);
    expect((await app.audit.list())).toEqual([]);
    expect((await app.notifications.list())).toEqual([]);
  });

  it.each(['/api/v1/identity/users', '/api/v1/identity/login'])('rejects malformed JSON and invalid input at %s', async (path) => {
    const malformed = await fetch(`${baseUrl}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-actor-roles': 'admin' }, body: '{',
    });
    await expectProblem(malformed, 400);
    await expectProblem(await post(path, { email: 'invalid', passwordHash: 'short' }, 'admin'), 400);
    expect(app.eventLog).toEqual([]);
  });

  it('locks out after the configured failures and keeps other accounts usable', async () => {
    await app.settings.set('security.max_login_attempts', 2);
    const registered = await post('/api/v1/identity/users', credentials, 'admin');
    expect(registered.status).toBe(201);
    await registered.json();
    const wrong = { ...credentials, passwordHash: 'wrong-hash' };
    await expectProblem(await post('/api/v1/identity/login', wrong), 401);
    await expectProblem(await post('/api/v1/identity/login', wrong), 401);
    await expectProblem(await post('/api/v1/identity/login', credentials), 429);

    const other = { email: 'other@example.com', passwordHash: 'password-hash' };
    const otherRegistered = await post('/api/v1/identity/users', other, 'admin');
    expect(otherRegistered.status).toBe(201);
    await otherRegistered.json();
    const otherLogin = await post('/api/v1/identity/login', other);
    expect(otherLogin.status).toBe(200);
    await otherLogin.json();
    expect(app.eventLog.filter((entry) => entry.startsWith('identity.user.login_failed.v1 '))).toHaveLength(3);
  });

  it('resets the failed attempt counter after a successful login', async () => {
    await app.settings.set('security.max_login_attempts', 2);
    const registered = await post('/api/v1/identity/users', credentials, 'admin');
    expect(registered.status).toBe(201);
    await registered.json();
    const wrong = { ...credentials, passwordHash: 'wrong-hash' };
    await expectProblem(await post('/api/v1/identity/login', wrong), 401);
    const login = await post('/api/v1/identity/login', credentials);
    expect(login.status).toBe(200);
    await login.json();
    await expectProblem(await post('/api/v1/identity/login', wrong), 401);
    const retry = await post('/api/v1/identity/login', credentials);
    expect(retry.status).toBe(200);
    await retry.json();
  });

  it('implements the OpenAPI login and current-user responses with request metadata', async () => {
    const standard = { email: 'standard@example.com', password: 'a-long-password' };
    const registered = await post('/api/v1/identity/users', standard, 'admin');
    expect(registered.status).toBe(201);
    const user = await registered.json();
    const response = await fetch(`${baseUrl}${contractOperation('login').route}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'req-123', 'x-correlation-id': 'corr-456' }, body: JSON.stringify(standard),
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('req-123');
    const login = await expectContract(response, 'login', 200);
    expect(login.meta).toEqual({ request_id: 'req-123', correlation_id: 'corr-456' });
    expect(login.data.access_token.split('.')).toHaveLength(3);
    const current = await fetch(`${baseUrl}${contractOperation('getCurrentUser').route}`, {
      headers: { authorization: `Bearer ${login.data.access_token}`, 'x-actor-id': 'someone-else', 'x-actor-roles': 'admin' },
    });
    const me = await expectContract(current, 'getCurrentUser', 200);
    expect(me.data).toEqual({ id: user.userId, email: standard.email, permissions: ['identity.user.read', 'identity.login'] });
    expect(me.meta.request_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(me.meta.correlation_id).toBe(me.meta.request_id);

    const stored = await app.users.get(user.userId);
    expect(stored.getPasswordDigest()).not.toContain(standard.password);
    await expectProblem(await post('/api/v1/identity/login', { email: standard.email, passwordHash: stored.getPasswordDigest() }), 401);
    await expectContract(await fetch(`${baseUrl}${contractOperation('getCurrentUser').route}`, {
      headers: { authorization: `Bearer ${login.data.refresh_token}` },
    }), 'getCurrentUser', 401);
  });

  it.each([undefined, 'Bearer token.fake', 'Basic test'])('rejects unauthenticated current-user access: %s', async (authorization) => {
    await expectContract(await fetch(`${baseUrl}${contractOperation('getCurrentUser').route}`, {
      headers: { ...(authorization ? { authorization } : {}), 'x-actor-roles': 'admin' },
    }), 'getCurrentUser', 401);
  });

  it('validates standard requests, credentials, and lockout against OpenAPI error schemas', async () => {
    const route = contractOperation('login').route;
    await expectContract(await post(route, { email: 'valid@example.com', password: 'password', extra: true }), 'login', 400);
    await expectContract(await post(route, credentials), 'login', 400);
    const invalidJson = await fetch(`${baseUrl}${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'invalid-json' }, body: '{"password":"secret-value"',
    });
    const error = await expectContract(invalidJson, 'login', 400);
    expect(JSON.stringify(error)).not.toContain('secret-value');
    expect(error.request_id).toBe('invalid-json');
    expect(error.instance).toBe(route);

    await app.settings.set('security.max_login_attempts', 1);
    await expectContract(await post(route, { email: 'unknown@example.com', password: 'incorrect-password' }), 'login', 401);
    await expectContract(await post(route, { email: 'unknown@example.com', password: 'incorrect-password' }), 'login', 429);
  });

  async function startSession() {
    const credentials = { email: 'session@example.com', password: 'a-long-password' };
    const registered = await post('/api/v1/identity/users', credentials, 'admin');
    expect(registered.status).toBe(201);
    await registered.json();
    const login = await expectContract(await post(contractOperation('login').route, credentials), 'login', 200);
    return { credentials, tokens: login.data };
  }

  function me(accessToken: string) {
    return fetch(`${baseUrl}${contractOperation('getCurrentUser').route}`, { headers: { authorization: `Bearer ${accessToken}` } });
  }

  it('rotates through OpenAPI refresh and revokes access/refresh tokens on logout', async () => {
    const { tokens } = await startSession();
    const rotated = await expectContract(await post(contractOperation('refreshSession').route, { refresh_token: tokens.refresh_token }), 'refreshSession', 200);
    expect(rotated.data.refresh_token).not.toBe(tokens.refresh_token);
    await expectContract(await me(rotated.data.access_token), 'getCurrentUser', 200);
    await expectContract(await me(tokens.access_token), 'getCurrentUser', 200);
    const logout = await fetch(`${baseUrl}${contractOperation('logout').route}`, {
      method: 'POST', headers: { authorization: `Bearer ${rotated.data.access_token}` },
    });
    await expectContract(logout, 'logout', 204);
    await expectContract(await me(tokens.access_token), 'getCurrentUser', 401);
    await expectContract(await me(rotated.data.access_token), 'getCurrentUser', 401);
    await expectContract(await post(contractOperation('refreshSession').route, { refresh_token: rotated.data.refresh_token }), 'refreshSession', 401);
    expect(app.eventLog.filter((entry) => entry.startsWith('identity.session.revoked.v1 '))).toHaveLength(1);
    expect((await app.audit.list()).filter((entry) => entry.action === 'identity.session.revoked')).toHaveLength(1);
    expect(JSON.stringify((await app.audit.list()))).not.toContain(tokens.refresh_token);
  });

  it('invalidates a replayed refresh family without revoking another login session', async () => {
    const { credentials, tokens } = await startSession();
    const other = await expectContract(await post(contractOperation('login').route, credentials), 'login', 200);
    const rotated = await expectContract(await post(contractOperation('refreshSession').route, { refresh_token: tokens.refresh_token }), 'refreshSession', 200);
    await expectContract(await post(contractOperation('refreshSession').route, { refresh_token: tokens.refresh_token }), 'refreshSession', 401);
    await expectContract(await me(rotated.data.access_token), 'getCurrentUser', 401);
    await expectContract(await post(contractOperation('refreshSession').route, { refresh_token: rotated.data.refresh_token }), 'refreshSession', 401);
    await expectContract(await me(other.data.access_token), 'getCurrentUser', 200);
    expect((await app.audit.list()).filter((entry) => entry.action === 'identity.session.revoked')).toHaveLength(1);
    expect((await app.audit.list()).find((entry) => entry.action === 'identity.session.revoked')?.data).toMatchObject({ reason: 'refresh_token_reuse' });
  });

  it('rejects invalid refresh requests and tokens using contract-shaped errors', async () => {
    const route = contractOperation('refreshSession').route;
    await expectContract(await post(route, {}), 'refreshSession', 400);
    await expectContract(await post(route, { refresh_token: 'short' }), 'refreshSession', 400);
    await expectContract(await post(route, { refresh_token: randomBytes(32).toString('base64url'), extra: true }), 'refreshSession', 400);
    await expectContract(await post(route, { refresh_token: randomBytes(32).toString('base64url') }), 'refreshSession', 401);
    const { tokens } = await startSession();
    await expectContract(await post(route, { refresh_token: tokens.access_token }), 'refreshSession', 400);
    await expectContract(await me(tokens.access_token), 'getCurrentUser', 200);
  });

  it('requires active bearer authentication for logout and rejects repeated logout', async () => {
    const route = contractOperation('logout').route;
    await expectContract(await fetch(`${baseUrl}${route}`, { method: 'POST' }), 'logout', 401);
    const { tokens } = await startSession();
    const options = { method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}` } };
    await expectContract(await fetch(`${baseUrl}${route}`, options), 'logout', 204);
    await expectContract(await fetch(`${baseUrl}${route}`, options), 'logout', 401);
  });

  it('fails closed when HTTP refresh requests race with the same token', async () => {
    const { tokens } = await startSession();
    const route = contractOperation('refreshSession').route;
    const responses = await Promise.all([post(route, { refresh_token: tokens.refresh_token }), post(route, { refresh_token: tokens.refresh_token })]);
    expect(responses.filter((response) => response.status === 200).length).toBeLessThanOrEqual(1);
    expect(responses.some((response) => response.status === 401)).toBe(true);
    for (const response of responses) {
      expect([200, 401]).toContain(response.status);
      const body = await expectContract(response, 'refreshSession', response.status);
      if (response.status === 200) await expectContract(await me(body.data.access_token), 'getCurrentUser', 401);
    }
    await expectContract(await me(tokens.access_token), 'getCurrentUser', 401);
  });
});
