import {
  ErrorCode,
  GamePhase,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SERVER_TICK_RATE,
  type ChatMessage,
  type CreateRoomPayload,
  type GameMap,
  type GameNotice,
  type JoinedRoom,
  type JoinRoomPayload,
  type ReconnectPayload,
  type RoomView,
  type WorldSnapshot,
} from '@stellar/shared';
import { logger } from '../lib/logger.js';
import { GameError } from './GameError.js';
import { GameRoom, type MatchSummary } from './GameRoom.js';
import { safeEqual, type Rng } from './random.js';

/** Outgoing messages, implemented with Socket.IO in production and with fakes in tests. */
export interface RoomTransport {
  sendState(socketId: string, view: RoomView): void;
  sendSnapshot(socketId: string, snapshot: WorldSnapshot): void;
  sendChat(socketId: string, message: ChatMessage): void;
  sendNotice(socketId: string, notice: GameNotice): void;
  sendClosed(socketId: string, reason: 'LEFT' | 'REMOVED'): void;
}

export interface RoomManagerOptions {
  map: GameMap;
  rng: Rng;
  transport: RoomTransport;
  minPlayers: number;
  onMatchFinished?: (summary: MatchSummary) => Promise<void>;
  now?: () => number;
}

interface Binding {
  code: string;
  playerId: string;
}

/**
 * Owns all rooms, maps sockets ⇄ players, runs the tick loop and flushes
 * per-player state to the transport. Rooms themselves stay transport-agnostic.
 */
export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly bindings = new Map<string, Binding>(); // socketId -> binding
  private readonly sockets = new Map<string, string>(); // `${code}:${playerId}` -> socketId
  private readonly dirty = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: RoomManagerOptions) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000 / SERVER_TICK_RATE);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ------------------------------------------------------------ membership

  createRoom(socketId: string, payload: CreateRoomPayload, userId: string | null): JoinedRoom {
    this.requireUnbound(socketId);
    const room = this.newRoom();
    const player = room.addPlayer(payload.name, payload.color, userId);
    this.bind(socketId, room.code, player.id);
    return { code: room.code, playerId: player.id, sessionToken: player.sessionToken };
  }

  joinRoom(socketId: string, payload: JoinRoomPayload, userId: string | null): JoinedRoom {
    this.requireUnbound(socketId);
    const room = this.rooms.get(payload.code);
    if (!room) throw new GameError(ErrorCode.ROOM_NOT_FOUND);
    const player = room.addPlayer(payload.name, payload.color, userId);
    this.bind(socketId, room.code, player.id);
    return { code: room.code, playerId: player.id, sessionToken: player.sessionToken };
  }

  /** Re-attaches a socket to an existing player (page reload, network drop). */
  reconnect(socketId: string, payload: ReconnectPayload): JoinedRoom {
    const room = this.rooms.get(payload.code);
    const player = room?.getPlayer(payload.playerId);
    if (!room || !player || !safeEqual(player.sessionToken, payload.sessionToken)) {
      throw new GameError(ErrorCode.UNAUTHORIZED);
    }
    const current = this.bindings.get(socketId);
    if (current && (current.code !== room.code || current.playerId !== player.id)) {
      throw new GameError(ErrorCode.ALREADY_IN_ROOM);
    }
    const previousSocket = this.sockets.get(this.key(room.code, player.id));
    if (previousSocket && previousSocket !== socketId) this.bindings.delete(previousSocket);
    this.bind(socketId, room.code, player.id);
    room.setConnected(player.id, true);
    return { code: room.code, playerId: player.id, sessionToken: player.sessionToken };
  }

  leave(socketId: string): void {
    const binding = this.bindings.get(socketId);
    if (!binding) throw new GameError(ErrorCode.NOT_IN_ROOM);
    const room = this.rooms.get(binding.code);
    this.unbind(socketId);
    room?.removePlayer(binding.playerId);
    this.cleanupRoom(binding.code);
  }

  /** Socket dropped: keep the seat for a grace period so the player can reconnect. */
  disconnect(socketId: string): void {
    const binding = this.bindings.get(socketId);
    if (!binding) return;
    this.unbind(socketId);
    this.rooms.get(binding.code)?.setConnected(binding.playerId, false);
  }

  /** Resolves the room and player bound to a socket, or throws NOT_IN_ROOM. */
  context(socketId: string): { room: GameRoom; playerId: string } {
    const binding = this.bindings.get(socketId);
    const room = binding ? this.rooms.get(binding.code) : undefined;
    if (!binding || !room) throw new GameError(ErrorCode.NOT_IN_ROOM);
    return { room, playerId: binding.playerId };
  }

  // ------------------------------------------------------------------ loop

  tick(): void {
    for (const room of this.rooms.values()) {
      try {
        room.tick();
      } catch (err) {
        logger.error('Room tick failed', { code: room.code, err: String(err) });
      }
      this.cleanupRoom(room.code);
    }
    this.flush(true);
  }

  /** Sends pending state updates; with `withSnapshots`, also world snapshots for active games. */
  flush(withSnapshots = false): void {
    const { transport } = this.options;
    for (const code of this.dirty) {
      const room = this.rooms.get(code);
      if (!room) continue;
      for (const playerId of room.connectedPlayerIds()) {
        const socketId = this.sockets.get(this.key(code, playerId));
        if (socketId) transport.sendState(socketId, room.viewFor(playerId));
      }
    }
    this.dirty.clear();

    if (!withSnapshots) return;
    for (const room of this.rooms.values()) {
      if (room.currentPhase !== GamePhase.PLAYING) continue;
      for (const playerId of room.connectedPlayerIds()) {
        const socketId = this.sockets.get(this.key(room.code, playerId));
        if (socketId) transport.sendSnapshot(socketId, room.snapshotFor(playerId));
      }
    }
  }

  // ------------------------------------------------------------- internals

  private newRoom(): GameRoom {
    const code = this.generateCode();
    const room = new GameRoom({
      code,
      map: this.options.map,
      rng: this.options.rng,
      minPlayers: this.options.minPlayers,
      ...(this.options.now ? { now: this.options.now } : {}),
      listener: {
        onStateChanged: () => this.dirty.add(code),
        onChat: (message) =>
          this.broadcast(code, (socketId) => this.options.transport.sendChat(socketId, message)),
        onNotice: (playerId, notice) => {
          if (playerId === null) {
            this.broadcast(code, (socketId) => this.options.transport.sendNotice(socketId, notice));
          } else {
            const socketId = this.sockets.get(this.key(code, playerId));
            if (socketId) this.options.transport.sendNotice(socketId, notice);
          }
        },
        onPlayerRemoved: (playerId) => {
          const socketId = this.sockets.get(this.key(code, playerId));
          if (socketId) {
            this.unbind(socketId);
            this.options.transport.sendClosed(socketId, 'REMOVED');
          }
        },
        onMatchFinished: (summary) => {
          this.options.onMatchFinished?.(summary).catch((err: unknown) => {
            logger.error('Failed to persist match', { code, err: String(err) });
          });
        },
      },
    });
    this.rooms.set(code, room);
    logger.info('room created', { code });
    return room;
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[this.options.rng.int(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new GameError(ErrorCode.INTERNAL, 'Could not allocate a room code');
  }

  private broadcast(code: string, send: (socketId: string) => void): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const playerId of room.connectedPlayerIds()) {
      const socketId = this.sockets.get(this.key(code, playerId));
      if (socketId) send(socketId);
    }
  }

  private cleanupRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room?.isEmpty) {
      this.rooms.delete(code);
      this.dirty.delete(code);
      logger.info('room closed', { code });
    }
  }

  private requireUnbound(socketId: string): void {
    if (this.bindings.has(socketId)) throw new GameError(ErrorCode.ALREADY_IN_ROOM);
  }

  private bind(socketId: string, code: string, playerId: string): void {
    this.bindings.set(socketId, { code, playerId });
    this.sockets.set(this.key(code, playerId), socketId);
    this.dirty.add(code);
  }

  private unbind(socketId: string): void {
    const binding = this.bindings.get(socketId);
    if (!binding) return;
    this.bindings.delete(socketId);
    const key = this.key(binding.code, binding.playerId);
    if (this.sockets.get(key) === socketId) this.sockets.delete(key);
  }

  private key(code: string, playerId: string): string {
    return `${code}:${playerId}`;
  }
}
