import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import type { HealthResponse } from '@stellar/shared';
import { logger } from '../lib/logger.js';
import { SERVER_VERSION } from '../version.js';

/** HTTP layer only: REST endpoints. No game logic here. */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      version: SERVER_VERSION,
    };
    res.json(body);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    logger.error('Unhandled HTTP error', { err: String(err) });
    res.status(500).json({ error: 'INTERNAL' });
  };
  app.use(errorHandler);

  return app;
}
