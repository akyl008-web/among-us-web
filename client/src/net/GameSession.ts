import type {
  Ack,
  ChatMessage,
  GameNotice,
  JoinedRoom,
  MoveInput,
  PlayerColor,
  RoomSettingsPatch,
  RoomView,
  SabotageType,
  WorldSnapshot,
} from '@stellar/shared';
import { ActionError } from './errors';
import { createSocket, type GameClientSocket } from './socket';
import { roomStorage } from './storage';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'danger';
}

export interface SessionState {
  connection: ConnectionState;
  joined: JoinedRoom | null;
  room: RoomView | null;
  /** performance.now() when `room` arrived — used to turn remainingMs into deadlines. */
  roomReceivedAt: number;
  chat: ChatMessage[];
  toasts: Toast[];
  userId: string | null;
}

type Listener = () => void;
type SnapshotListener = (snapshot: WorldSnapshot, receivedAt: number) => void;

const ACK_TIMEOUT_MS = 5000;

/**
 * Single source of truth for the client: wraps the socket, keeps the latest
 * private room view for React and streams world snapshots to Phaser.
 * React subscribes via useSyncExternalStore; Phaser via onSnapshot().
 */
export class GameSession {
  private readonly socket: GameClientSocket = createSocket();
  private state: SessionState = {
    connection: 'connecting',
    joined: roomStorage.load(),
    room: null,
    roomReceivedAt: 0,
    chat: [],
    toasts: [],
    userId: null,
  };
  private readonly listeners = new Set<Listener>();
  private readonly snapshotListeners = new Set<SnapshotListener>();
  private toastId = 0;
  private inputSeq = 0;
  latestSnapshot: WorldSnapshot | null = null;

  constructor() {
    const s = this.socket;
    s.on('connect', () => {
      this.set({ connection: 'connected' });
      void this.tryReconnect();
    });
    s.on('disconnect', () => this.set({ connection: 'disconnected' }));
    s.on('connect_error', () => this.set({ connection: 'disconnected' }));
    s.on('system:hello', ({ userId }) => this.set({ userId }));
    s.on('room:state', (room) => {
      const phaseChanged = this.state.room?.phase !== room.phase;
      // Positions from a previous match must never leak into the next one.
      if (phaseChanged && (room.phase === 'WAITING' || room.phase === 'STARTING'))
        this.latestSnapshot = null;
      this.set({
        room,
        roomReceivedAt: performance.now(),
        ...(phaseChanged && room.phase === 'MEETING' ? { chat: [] } : {}),
      });
    });
    s.on('room:closed', () => this.clearRoom());
    s.on('game:snapshot', (snapshot) => {
      this.latestSnapshot = snapshot;
      const now = performance.now();
      // One broken listener must never starve the others.
      for (const listener of this.snapshotListeners) {
        try {
          listener(snapshot, now);
        } catch (err) {
          console.error('Snapshot listener failed', err);
        }
      }
    });
    s.on('meeting:message', (message) =>
      this.set({ chat: [...this.state.chat, message].slice(-100) }),
    );
    s.on('game:notice', (notice) => this.handleNotice(notice));
  }

  // ------------------------------------------------------------ store API

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): SessionState => this.state;

  onSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  connect(): void {
    if (!this.socket.connected) this.socket.connect();
  }

  /** Re-handshake (e.g. after login) so the server sees the new auth token. */
  reconnectSocket(): void {
    this.socket.disconnect();
    this.socket.connect();
  }

  dismissToast(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  toast(text: string, tone: Toast['tone'] = 'info'): void {
    const toast = { id: ++this.toastId, text, tone };
    this.set({ toasts: [...this.state.toasts, toast].slice(-4) });
    window.setTimeout(() => this.dismissToast(toast.id), 4000);
  }

  // -------------------------------------------------------------- actions

  async createRoom(name: string, color: PlayerColor): Promise<void> {
    this.remember(
      await this.request<JoinedRoom>((ack) =>
        this.socket.emit('room:create', { name, color }, ack),
      ),
    );
  }

  async joinRoom(code: string, name: string, color: PlayerColor): Promise<void> {
    this.remember(
      await this.request<JoinedRoom>((ack) =>
        this.socket.emit('room:join', { code, name, color }, ack),
      ),
    );
  }

  async leaveRoom(): Promise<void> {
    try {
      await this.request((ack) => this.socket.emit('room:leave', ack));
    } finally {
      this.clearRoom();
    }
  }

  updateLobby = (patch: { name?: string; color?: PlayerColor }) =>
    this.request((ack) => this.socket.emit('lobby:update', patch, ack));
  updateSettings = (patch: RoomSettingsPatch) =>
    this.request((ack) => this.socket.emit('lobby:settings', patch, ack));
  startGame = () => this.request((ack) => this.socket.emit('game:start', ack));
  returnToLobby = () => this.request((ack) => this.socket.emit('game:returnToLobby', ack));
  startTask = (taskId: string) =>
    this.request((ack) => this.socket.emit('task:start', { taskId }, ack));
  cancelTask = () => this.request((ack) => this.socket.emit('task:cancel', ack));
  completeTask = (taskId: string) =>
    this.request((ack) => this.socket.emit('task:complete', { taskId }, ack));
  kill = (targetId: string) =>
    this.request((ack) => this.socket.emit('impostor:kill', { targetId }, ack));
  report = (bodyId: string) =>
    this.request((ack) => this.socket.emit('body:report', { bodyId }, ack));
  callMeeting = () => this.request((ack) => this.socket.emit('meeting:call', ack));
  vote = (targetId: string | null) =>
    this.request((ack) => this.socket.emit('meeting:vote', { targetId }, ack));
  sendChat = (text: string) =>
    this.request((ack) => this.socket.emit('meeting:chat', { text }, ack));
  sabotage = (type: SabotageType) =>
    this.request((ack) => this.socket.emit('sabotage:trigger', { type }, ack));
  fixSabotage = (stationId: string) =>
    this.request((ack) => this.socket.emit('sabotage:fix', { stationId }, ack));

  /** Movement intent (no ack). Sequence numbers let the server drop stale packets. */
  sendInput(input: MoveInput): void {
    if (!this.socket.connected) return;
    this.socket.emit('player:input', { seq: ++this.inputSeq, ...input });
  }

  // ------------------------------------------------------------ internals

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private request<T = null>(send: (ack: (res: Ack<T>) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        reject(new Error('Нет соединения с сервером'));
        return;
      }
      const timer = window.setTimeout(() => reject(new Error('Сервер не ответил')), ACK_TIMEOUT_MS);
      send((res) => {
        window.clearTimeout(timer);
        if (res.ok) resolve(res.data);
        else reject(new ActionError(res.error));
      });
    });
  }

  private remember(joined: JoinedRoom): void {
    roomStorage.save(joined);
    this.set({ joined });
  }

  private clearRoom(): void {
    roomStorage.save(null);
    this.latestSnapshot = null;
    this.set({ joined: null, room: null, chat: [] });
  }

  /** After a reload or network drop, re-attach to the room with the stored session token. */
  private async tryReconnect(): Promise<void> {
    const joined = this.state.joined;
    if (!joined) return;
    try {
      await this.request<JoinedRoom>((ack) => this.socket.emit('room:reconnect', joined, ack));
    } catch {
      this.clearRoom();
    }
  }

  private handleNotice(notice: GameNotice): void {
    const room = this.state.room;
    const name = (id: string) => room?.players.find((p) => p.id === id)?.name ?? 'Игрок';
    switch (notice.type) {
      case 'KILLED':
        this.toast('Вас устранили. Теперь вы призрак: наблюдайте за игрой.', 'danger');
        break;
      case 'KILL_CONFIRMED':
        this.toast(`Цель устранена: ${name(notice.victimId)}`, 'danger');
        break;
      case 'HOST_CHANGED':
        this.toast(`Новый хост: ${name(notice.hostId)}`);
        break;
      case 'PLAYER_LEFT':
        this.toast(`${notice.name} покинул игру`);
        break;
    }
  }
}
