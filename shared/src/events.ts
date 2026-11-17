import type { ChatMessage, GameNotice, JoinedRoom, RoomView, WorldSnapshot } from './protocol.js';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  LobbyUpdatePayload,
  PingPayload,
  PlayerInputPayload,
  ReconnectPayload,
  RoomSettingsPatch,
} from './schemas.js';
import type { SabotageType } from './protocol.js';

/** Standard acknowledgement shape for every request/response style event. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message?: string };
export type AckCallback<T = null> = (res: Ack<T>) => void;

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  ALREADY_IN_ROOM: 'ALREADY_IN_ROOM',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  NOT_HOST: 'NOT_HOST',
  INVALID_STATE: 'INVALID_STATE',
  NOT_ALLOWED: 'NOT_ALLOWED',
  TOO_FAR: 'TOO_FAR',
  COOLDOWN: 'COOLDOWN',
  ALREADY_DONE: 'ALREADY_DONE',
  NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
  COLOR_TAKEN: 'COLOR_TAKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface PongData {
  clientTime: number;
  serverTime: number;
}

export interface ServerHello {
  serverVersion: string;
  socketId: string;
  userId: string | null;
}

/**
 * Socket.IO contract. Naming: `<domain>:<action>`.
 * Client sends INTENTS; server validates and answers via ack or broadcasts state.
 * Payload types come from the Zod schemas — the server re-validates every one.
 */
export interface ClientToServerEvents {
  'system:ping': (payload: PingPayload, ack: AckCallback<PongData>) => void;

  'room:create': (payload: CreateRoomPayload, ack: AckCallback<JoinedRoom>) => void;
  'room:join': (payload: JoinRoomPayload, ack: AckCallback<JoinedRoom>) => void;
  'room:reconnect': (payload: ReconnectPayload, ack: AckCallback<JoinedRoom>) => void;
  'room:leave': (ack: AckCallback) => void;

  'lobby:update': (payload: LobbyUpdatePayload, ack: AckCallback) => void;
  'lobby:settings': (payload: RoomSettingsPatch, ack: AckCallback) => void;
  'game:start': (ack: AckCallback) => void;
  'game:returnToLobby': (ack: AckCallback) => void;

  /** High-frequency, no ack. */
  'player:input': (payload: PlayerInputPayload) => void;

  'task:start': (payload: { taskId: string }, ack: AckCallback) => void;
  'task:cancel': (ack: AckCallback) => void;
  'task:complete': (payload: { taskId: string }, ack: AckCallback) => void;
  'impostor:kill': (payload: { targetId: string }, ack: AckCallback) => void;
  'body:report': (payload: { bodyId: string }, ack: AckCallback) => void;
  'meeting:call': (ack: AckCallback) => void;
  'meeting:vote': (payload: { targetId: string | null }, ack: AckCallback) => void;
  'meeting:chat': (payload: { text: string }, ack: AckCallback) => void;
  'sabotage:trigger': (payload: { type: SabotageType }, ack: AckCallback) => void;
  'sabotage:fix': (payload: { stationId: string }, ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  'system:hello': (data: ServerHello) => void;
  'room:state': (view: RoomView) => void;
  'room:closed': (data: { reason: 'LEFT' | 'REMOVED' }) => void;
  'game:snapshot': (snapshot: WorldSnapshot) => void;
  'game:notice': (notice: GameNotice) => void;
  'meeting:message': (message: ChatMessage) => void;
}

/** Server-to-server (adapter) events — unused for now. */
export type InterServerEvents = Record<string, never>;

/** Per-socket data stored on the server (`socket.data`). */
export interface SocketData {
  connectedAt: number;
  userId: string | null;
}

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
  persistence: 'postgres' | 'memory';
}
