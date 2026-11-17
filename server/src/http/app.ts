import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import type { HealthResponse } from '@stellar/shared';
import type { AuthService } from '../auth/AuthService.js';
import type { Persistence } from '../db/types.js';
import { logger } from '../lib/logger.js';
import { SERVER_VERSION } from '../version.js';
import { createAuthRouter } from './authRoutes.js';

export interface AppDeps {
  auth: AuthService;
  persistence: Persistence;
  serveClient?: boolean;
  trustProxy?: boolean;
}

/** HTTP layer only: REST endpoints + optional static client. No game logic here. */
export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (deps.trustProxy) app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Phaser needs blob: workers/images and inline styles for the canvas.
          'img-src': ["'self'", 'data:', 'blob:'],
          'worker-src': ["'self'", 'blob:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
        },
      },
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      version: SERVER_VERSION,
      persistence: deps.persistence.kind,
    };
    res.json(body);
  });

  app.use('/api', createAuthRouter(deps.auth, deps.persistence));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });

  if (deps.serveClient) {
    const clientDist = resolve(import.meta.dirname, '../../../client/dist');
    if (existsSync(clientDist)) {
      app.use(express.static(clientDist, { maxAge: '1h', index: false }));
      // SPA fallback
      app.get(/^\/(?!api|socket\.io).*/, (_req, res) =>
        res.sendFile(resolve(clientDist, 'index.html')),
      );
      logger.info(`Serving client from ${clientDist}`);
    } else {
      logger.warn(`SERVE_CLIENT=true but ${clientDist} does not exist — run "npm run build" first`);
    }
  }

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'VALIDATION_FAILED' });
      return;
    }
    logger.error('Unhandled HTTP error', { err: String(err) });
    res.status(500).json({ error: 'INTERNAL' });
  };
  app.use(errorHandler);

  return app;
}
