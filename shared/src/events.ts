import type { PingPayload } from './schemas.js';

/** Standard acknowledgement shape for every request/response style event. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message?: string };

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface PongData {
  clientTime: number;
  serverTime: number;
}

export interface ServerHello {
  serverVersion: string;
  socketId: string;
}

/**
 * Socket.IO contract. Naming: `<domain>:<action>`.
 * Client sends INTENTS; server validates and answers via ack or broadcasts state.
 */
export interface ClientToServerEvents {
  'system:ping': (payload: PingPayload, ack: (res: Ack<PongData>) => void) => void;
}

export interface ServerToClientEvents {
  'system:hello': (data: ServerHello) => void;
}

/** Server-to-server (adapter) events — unused for now. */
export type InterServerEvents = Record<string, never>;

/** Per-socket data stored on the server (`socket.data`). */
export interface SocketData {
  connectedAt: number;
}

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
}
