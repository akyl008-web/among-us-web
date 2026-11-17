import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { AuthService } from '../auth/AuthService.js';
import type { RoomManager, RoomTransport } from '../game/RoomManager.js';
import { logger } from '../lib/logger.js';
import { SERVER_VERSION } from '../version.js';
import { createResponder } from './handlerKit.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerSystemHandlers } from './handlers/systemHandlers.js';
import { RateLimiter } from './rateLimiter.js';
import type { GameServer } from './types.js';

export interface SocketServerOptions {
  corsOrigins: string[];
  auth: AuthService;
}

/** Socket.IO implementation of the RoomManager's outgoing channel. */
export function createSocketTransport(io: GameServer): RoomTransport {
  return {
    sendState: (socketId, view) => io.to(socketId).emit('room:state', view),
    sendSnapshot: (socketId, snapshot) => io.to(socketId).volatile.emit('game:snapshot', snapshot),
    sendChat: (socketId, message) => io.to(socketId).emit('meeting:message', message),
    sendNotice: (socketId, notice) => io.to(socketId).emit('game:notice', notice),
    sendClosed: (socketId, reason) => io.to(socketId).emit('room:closed', { reason }),
  };
}

export function createSocketServer(
  httpServer: HttpServer,
  options: SocketServerOptions,
): GameServer {
  return new Server(httpServer, {
    cors: { origin: options.corsOrigins },
    maxHttpBufferSize: 16 * 1024, // reject oversized payloads
    pingInterval: 10_000,
    pingTimeout: 5_000,
  });
}

/** Realtime layer: authentication, rate limiting and event routing. Rules live in game/. */
export function attachRealtime(io: GameServer, rooms: RoomManager, auth: AuthService): void {
  const actionLimiter = new RateLimiter(10, 5); // per socket+event
  const joinLimiter = new RateLimiter(5, 0.2); // brute-force protection for room codes
  const chatLimiter = new RateLimiter(4, 0.5);
  const inputLimiter = new RateLimiter(60, 40);
  const systemLimiter = new RateLimiter(10, 5);

  // Optional login: a valid token links the player to a profile; guests are welcome.
  io.use((socket, next) => {
    const token: unknown = (socket.handshake.auth as Record<string, unknown> | undefined)?.token;
    socket.data.userId = auth.verifyToken(token);
    next();
  });

  io.on('connection', (socket) => {
    socket.data.connectedAt = Date.now();
    logger.info('socket connected', { id: socket.id, user: socket.data.userId ?? 'guest' });

    const afterAction = () => rooms.flush();
    registerSystemHandlers(socket, systemLimiter);
    registerRoomHandlers(
      socket,
      rooms,
      createResponder(socket, actionLimiter, afterAction),
      createResponder(socket, joinLimiter, afterAction),
    );
    registerGameHandlers(
      socket,
      rooms,
      createResponder(socket, actionLimiter, afterAction),
      createResponder(socket, chatLimiter, afterAction),
      inputLimiter,
    );

    socket.emit('system:hello', {
      serverVersion: SERVER_VERSION,
      socketId: socket.id,
      userId: socket.data.userId,
    });

    socket.on('disconnect', (reason) => {
      rooms.disconnect(socket.id);
      rooms.flush();
      for (const limiter of [
        actionLimiter,
        joinLimiter,
        chatLimiter,
        inputLimiter,
        systemLimiter,
      ]) {
        limiter.clearPrefix(socket.id);
      }
      logger.info('socket disconnected', { id: socket.id, reason });
    });
  });
}
