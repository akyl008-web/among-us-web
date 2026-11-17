import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import type { AppConfig } from './config/env.js';
import { createApp } from './http/app.js';
import { createSocketServer } from './realtime/io.js';
import type { GameServer } from './realtime/types.js';

export interface RunningServer {
  httpServer: HttpServer;
  io: GameServer;
  close: () => Promise<void>;
}

/** Composition root: wires HTTP and realtime layers. Used by index.ts and tests. */
export function createServer(config: Pick<AppConfig, 'CLIENT_ORIGIN'>): RunningServer {
  const app = createApp();
  const httpServer = createHttpServer(app);
  const io = createSocketServer(httpServer, { corsOrigins: config.CLIENT_ORIGIN });

  const close = () =>
    new Promise<void>((resolve, reject) => {
      // io.close() also closes the underlying HTTP server
      void io.close((err) => (err ? reject(err) : resolve()));
    });

  return { httpServer, io, close };
}
