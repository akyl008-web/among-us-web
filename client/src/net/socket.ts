import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@stellar/shared';
import { SERVER_URL } from '../config/env';
import { tokenStorage } from './storage';

export type GameClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Strictly-typed socket. The login token (if any) is sent in the handshake on every (re)connect. */
export function createSocket(): GameClientSocket {
  return io(SERVER_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    auth: (cb) => {
      const token = tokenStorage.load();
      cb(token ? { token } : {});
    },
  });
}
