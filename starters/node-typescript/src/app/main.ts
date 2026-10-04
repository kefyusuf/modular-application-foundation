import { createServer } from 'node:http';
import { createApplication } from './application.js';
import { readTokenKeyRing } from './token-config.js';
import { PostgresDatabase } from '../infrastructure/postgres.js';

const database = process.env.DATABASE_URL ? new PostgresDatabase(process.env.DATABASE_URL) : undefined;
const application = await createApplication({ tokenKeys: readTokenKeyRing(process.env), database }).catch(async (error) => {
  await database?.close();
  throw error;
});
const { handler } = application;
const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  void handler(req, res);
});

let polling = false;
let pendingPoll: Promise<unknown> = Promise.resolve();
const timer = application.outbox ? setInterval(() => {
  if (polling) return;
  polling = true;
  pendingPoll = application.outbox!.drain().then(({ failed }) => {
    if (failed) console.error('Outbox delivery failed; scheduled for retry');
  }).catch(() => console.error('Outbox poll failed')).finally(() => { polling = false; });
}, 1000) : undefined;
timer?.unref();

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pendingPoll;
  await application.close();
}
process.once('SIGINT', () => { void stop().catch(() => { process.exitCode = 1; }); });
process.once('SIGTERM', () => { void stop().catch(() => { process.exitCode = 1; }); });
server.once('error', () => {
  console.error('HTTP server failed');
  process.exitCode = 1;
  void stop().catch(() => { process.exitCode = 1; });
});

server.listen(port, () => {
  console.log(`modular-application-foundation skeleton listening on :${port}`);
});
