import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function requestContext(req: IncomingMessage, res: ServerResponse) {
  const identifier = (header: string | string[] | undefined) => typeof header === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(header) ? header : randomUUID();
  const requestId = identifier(req.headers['x-request-id']);
  const correlationId = req.headers['x-correlation-id'] === undefined ? requestId : identifier(req.headers['x-correlation-id']);
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);
  return { request_id: requestId, correlation_id: correlationId };
}
