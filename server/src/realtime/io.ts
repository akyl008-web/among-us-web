import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { logger } from '../lib/logger.js';
import { SERVER_VERSION } from '../version.js';
import { registerSystemHandlers } from './handlers/systemHandlers.js';
import { RateLimiter } from './rateLimiter.js';
import type { GameServer } from './types.js';

export interface SocketServerOptions {
  corsOrigins: string[];
}

/** Realtime layer: transport + event routing. Game rules will live in a separate `game/` module. */
export function createSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions,
): GameServer {
  const io: GameServer = new Server(httpServer, {
    cors: { origin: options.corsOrigins },
    maxHttpBufferSize: 16 * 1024, // reject oversized payloads
    pingInterval: 10_000,
    pingTimeout: 5_000,
  });

  // 10 events burst, 5/sec sustained per socket+event
  const limiter = new RateLimiter(10, 5);

  io.on('connection', (socket) => {
    socket.data.connectedAt = Date.now();
    logger.info('socket connected', { id: socket.id });

    registerSystemHandlers(socket, limiter);
    socket.emit('system:hello', { serverVersion: SERVER_VERSION, socketId: socket.id });

    socket.on('disconnect', (reason) => {
      limiter.clearPrefix(`${socket.id}:`);
      logger.info('socket disconnected', { id: socket.id, reason });
    });
  });

  return io;
}
