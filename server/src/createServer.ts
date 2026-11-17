import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { SKYWARD_MAP } from '@stellar/shared';
import { AuthService } from './auth/AuthService.js';
import { createMemoryPersistence } from './db/memoryPersistence.js';
import type { Persistence } from './db/types.js';
import { cryptoRng, type Rng } from './game/random.js';
import { RoomManager } from './game/RoomManager.js';
import { createApp } from './http/app.js';
import { attachRealtime, createSocketServer, createSocketTransport } from './realtime/io.js';
import type { GameServer } from './realtime/types.js';

export interface ServerOptions {
  corsOrigins: string[];
  authSecret: string;
  minPlayers: number;
  persistence?: Persistence;
  serveClient?: boolean;
  trustProxy?: boolean;
  rng?: Rng;
  now?: () => number;
}

export interface RunningServer {
  httpServer: HttpServer;
  io: GameServer;
  rooms: RoomManager;
  persistence: Persistence;
  close: () => Promise<void>;
}

/** Composition root: wires HTTP, realtime, game and persistence layers. Used by index.ts and tests. */
export function createServer(options: ServerOptions): RunningServer {
  const persistence = options.persistence ?? createMemoryPersistence();
  const auth = new AuthService(options.authSecret);
  const app = createApp({
    auth,
    persistence,
    ...(options.serveClient !== undefined ? { serveClient: options.serveClient } : {}),
    ...(options.trustProxy !== undefined ? { trustProxy: options.trustProxy } : {}),
  });
  const httpServer = createHttpServer(app);
  const io = createSocketServer(httpServer, { corsOrigins: options.corsOrigins, auth });

  const rooms = new RoomManager({
    map: SKYWARD_MAP,
    rng: options.rng ?? cryptoRng,
    transport: createSocketTransport(io),
    minPlayers: options.minPlayers,
    onMatchFinished: (summary) => persistence.matches.record(summary),
    ...(options.now ? { now: options.now } : {}),
  });
  attachRealtime(io, rooms, auth);
  rooms.start();

  const close = async () => {
    rooms.stop();
    await new Promise<void>((resolve, reject) => {
      // io.close() also closes the underlying HTTP server
      void io.close((err) => (err ? reject(err) : resolve()));
    });
    await persistence.close();
  };

  return { httpServer, io, rooms, persistence, close };
}
