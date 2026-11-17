import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@stellar/shared';
import { SERVER_URL } from '../config/env';

export type GameClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameClientSocket | null = null;

/** Single shared, strictly-typed socket. Connect explicitly via `socket.connect()`. */
export function getSocket(): GameClientSocket {
  socket ??= io(SERVER_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  return socket;
}
