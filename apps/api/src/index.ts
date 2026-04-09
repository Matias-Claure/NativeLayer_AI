import { buildApp } from './app.js';
import { createLogger } from '@nativelayer/observability';

const log = createLogger('api');

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const HOST = process.env['API_HOST'] ?? '0.0.0.0';

async function start() {
  const app = buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    log.info(`NativeLayer API running on http://${HOST}:${PORT}`);
  } catch (err) {
    log.error({ err }, 'Failed to start API server');
    process.exit(1);
  }
}

void start();
