import type { ServerResponse } from 'node:http';

export function writeProblem(
  res: ServerResponse,
  status: number,
  title: string,
  detail?: string,
  context?: { request_id: string; correlation_id: string; instance?: string },
): void {
  res.writeHead(status, { 'content-type': 'application/problem+json' });
  res.end(
    JSON.stringify({
      type: 'about:blank',
      title,
      status,
      ...(detail ? { detail } : {}),
      ...context,
    }),
  );
}
