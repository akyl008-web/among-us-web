import { loadConfig } from './config/env.js';
import { createServer } from './createServer.js';
import { logger } from './lib/logger.js';

const config = loadConfig();
const server = createServer(config);

server.httpServer.listen(config.PORT, config.HOST, () => {
  logger.info(`Server listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

server.httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${config.PORT} is already in use. Change PORT in server/.env`);
  } else {
    logger.error('HTTP server error', { err: String(err) });
  }
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  await server
    .close()
    .catch((err: unknown) => logger.error('Shutdown error', { err: String(err) }));
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
