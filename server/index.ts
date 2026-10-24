import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
// After `npm run build` the client sits next to the server bundle (dist/client).
const builtClient = fileURLToPath(new URL('../client', import.meta.url));
const staticDir = existsSync(`${builtClient}/assets`) ? builtClient : undefined;

const app = createApp({ staticDir });
app.http.listen(port, () => {
  console.log(`Nomad server listening on http://localhost:${port}${staticDir ? '' : ' (API only, run the Vite dev server for the client)'}`);
});

const shutdown = () => {
  void app.close().then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
