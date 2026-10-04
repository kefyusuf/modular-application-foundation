import { createServer } from 'node:http';
import { createApplication } from './application.js';
import { readTokenKeyRing } from './token-config.js';

const { handler } = await createApplication({ tokenKeys: readTokenKeyRing(process.env) });
const port = Number(process.env.PORT ?? 3000);
const server = createServer((req, res) => { void handler(req, res); });
server.listen(port, () => {
  console.log(`modular-application-foundation skeleton listening on :${port}`);
});