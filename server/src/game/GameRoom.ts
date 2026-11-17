import {
  DEFAULT_ROOM_SETTINGS,
  distance,
  ErrorCode,
  GAME_DISCONNECT_GRACE_MS,
  GamePhase,
  getVelocity,
  IDLE_INPUT,
  INITIAL_KILL_COOLDOWN_MS,
  INTERACT_RANGE,
  isMoving,
  KILL_RANGE,
  LOBBY_DISCONNECT_GRACE_MS,
  MAX_PLAYERS,
  MeetingReason,
  MeetingStage,
  moveWithCollision,
  PLAYER_COLORS,
  REACTOR_MELTDOWN_MS,
  REPORT_RANGE,
  RESULT_DURATION_MS,
  Role,
  SABOTAGE_COOLDOWN_MS,
  SabotageType,
  STARTING_COUNTDOWN_MS,
  TASK_MIN_DURATION_MS,
  Team,
  WinReason,
  type ChatMessage,
  type GameMap,
  type GameNotice,
  type GameOverView,
  type MoveInput,
  type PlayerColor,
  type RoomSettings,
  type RoomSettingsPatch,
  type RoomView,
  type Vector2,
  type WorldSnapshot,
} from '@stellar/shared';
import { GameError } from './GameError.js';
import { createToken, shuffle, type Rng } from './random.js';

export interface PlayerState {
  id: string;
  sessionToken: string;
  userId: string | null;
  name: string;
  color: PlayerColor;
  connected: boolean;
  disconnectedAt: number | null;
  /** Left for good (kept only so the game-over screen can reveal their role). */
  left: boolean;
  role: Role | null;
  alive: boolean;
  /** Death has been revealed to everyone (body found / meeting / ejection). */
  deathKnown: boolean;
  x: number;
  y: number;
  input: MoveInput;
  lastInputSeq: number;
  facing: 1 | -1;
  tasks: { id: string; done: boolean }[];
  activeTask: { id: string; startedAt: number } | null;
  emergencyLeft: number;
  killReadyAt: number;
  kills: number;
  tasksCompleted: number;
}

interface Body {
  ownerId: string;
  x: number;
  y: number;
}

interface Meeting {
  reason: MeetingReason;
  calledById: string;
  bodyOwnerId: string | null;
  stage: MeetingStage;
  stageEndsAt: number;
  votes: Map<string, string | null>;
}

interface MeetingResult {
  ejectedId: string | null;
  ejectedWasImpostor: boolean | null;
  tie: boolean;
  votes: Record<string, string[]>;
  skipVoterIds: string[];
  endsAt: number;
}

interface ActiveSabotage {
  type: SabotageType;
  endsAt: number | null;
  fixed: Set<string>;
}

/** Summary handed to persistence when a match ends. */
export interface MatchSummary {
  roomCode: string;
  startedAt: Date;
  endedAt: Date;
  winner: Team;
  reason: WinReason;
  impostorCount: number;
  meetings: number;
  ejections: number;
  sabotages: number;
  participants: {
    userId: string | null;
    name: string;
    color: PlayerColor;
    role: Role;
    won: boolean;
    survived: boolean;
    tasksCompleted: number;
    kills: number;
  }[];
}

/** Side effects the room needs from the outside world (implemented by RoomManager). */
export interface RoomListener {
  onStateChanged(): void;
  onChat(message: ChatMessage): void;
  onNotice(playerId: string | null, notice: GameNotice): void;
  onPlayerRemoved(playerId: string): void;
  onMatchFinished(summary: MatchSummary): void;
}

export interface GameRoomOptions {
  code: string;
  map: GameMap;
  rng: Rng;
  now?: () => number;
  minPlayers: number;
  listener: RoomListener;
}

let playerCounter = 0;
const nextPlayerId = () => `p${(++playerCounter).toString(36)}${Date.now().toString(36).slice(-4)}`;

/**
 * Authoritative state machine of one room:
 * WAITING → STARTING → PLAYING ⇄ MEETING → RESULT → PLAYING | FINISHED → WAITING.
 *
 * Pure game logic: no sockets, no database. Every public method validates the
 * caller's permissions and the current phase and throws GameError on violation.
 */
export class GameRoom {
  readonly code: string;
  private readonly map: GameMap;
  private readonly rng: Rng;
  private readonly now: () => number;
  private readonly minPlayers: number;
  private readonly listener: RoomListener;

  private readonly players = new Map<string, PlayerState>();
  private phase: GamePhase = GamePhase.WAITING;
  private hostId = '';
  private settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };

  private startingEndsAt = 0;
  private bodies: Body[] = [];
  private meeting: Meeting | null = null;
  private result: MeetingResult | null = null;
  private sabotage: ActiveSabotage | null = null;
  private sabotageReadyAt = 0;
  private gameOver: GameOverView | null = null;
  private tickCount = 0;
  private lastTickAt: number;
  private chatCounter = 0;
  private matchStartedAt = 0;
  private stats = { meetings: 0, ejections: 0, sabotages: 0 };

  constructor(options: GameRoomOptions) {
    this.code = options.code;
    this.map = options.map;
    this.rng = options.rng;
    this.now = options.now ?? Date.now;
    this.minPlayers = options.minPlayers;
    this.listener = options.listener;
    this.lastTickAt = this.now();
  }

  // ---------------------------------------------------------------- queries

  get currentPhase(): GamePhase {
    return this.phase;
  }

  get playerCount(): number {
    return this.activePlayers().length;
  }

  get isEmpty(): boolean {
    return this.activePlayers().length === 0;
  }

  getPlayer(id: string): PlayerState | undefined {
    const p = this.players.get(id);
    return p && !p.left ? p : undefined;
  }

  connectedPlayerIds(): string[] {
    return this.activePlayers()
      .filter((p) => p.connected)
      .map((p) => p.id);
  }

  // ----------------------------------------------------------- membership

  addPlayer(
    name: string,
    requestedColor: PlayerColor | undefined,
    userId: string | null,
  ): PlayerState {
    if (this.phase !== GamePhase.WAITING) throw new GameError(ErrorCode.GAME_IN_PROGRESS);
    if (this.activePlayers().length >= MAX_PLAYERS) throw new GameError(ErrorCode.ROOM_FULL);

    const spawn = this.spawnFor(this.activePlayers().length);
    const player: PlayerState = {
      id: nextPlayerId(),
      sessionToken: createToken(),
      userId,
      name: this.uniqueName(name),
      color: this.pickColor(requestedColor),
      connected: true,
      disconnectedAt: null,
      left: false,
      role: null,
      alive: true,
      deathKnown: false,
      x: spawn.x,
      y: spawn.y,
      input: { ...IDLE_INPUT },
      lastInputSeq: 0,
      facing: 1,
      tasks: [],
      activeTask: null,
      emergencyLeft: this.settings.emergencyMeetings,
      killReadyAt: 0,
      kills: 0,
      tasksCompleted: 0,
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.changed();
    return player;
  }

  setConnected(playerId: string, connected: boolean): void {
    const p = this.requirePlayer(playerId);
    p.connected = connected;
    p.disconnectedAt = connected ? null : this.now();
    if (!connected) {
      p.input = { ...IDLE_INPUT };
      p.activeTask = null;
    }
    this.changed();
  }

  /** Removes a player: from the lobby entirely, from a running game as "left" (counts as dead). */
  removePlayer(playerId: string): void {
    if (this.markRemoved(playerId)) this.afterRemoval();
  }

  updateLobby(
    playerId: string,
    patch: { name?: string | undefined; color?: PlayerColor | undefined },
  ): void {
    const p = this.requirePlayer(playerId);
    if (this.phase !== GamePhase.WAITING) throw new GameError(ErrorCode.INVALID_STATE);
    if (patch.color && patch.color !== p.color) {
      const taken = this.activePlayers().some((o) => o.id !== p.id && o.color === patch.color);
      if (taken) throw new GameError(ErrorCode.COLOR_TAKEN);
      p.color = patch.color;
    }
    if (patch.name && patch.name !== p.name) p.name = this.uniqueName(patch.name, p.id);
    this.changed();
  }

  updateSettings(playerId: string, patch: RoomSettingsPatch): void {
    this.requireHost(playerId);
    if (this.phase !== GamePhase.WAITING) throw new GameError(ErrorCode.INVALID_STATE);
    const next = { ...this.settings };
    for (const [key, value] of Object.entries(patch) as [keyof RoomSettings, never][]) {
      if (value !== undefined) next[key] = value;
    }
    this.settings = next;
    for (const p of this.activePlayers()) p.emergencyLeft = next.emergencyMeetings;
    this.changed();
  }

  // ------------------------------------------------------------ lifecycle

  start(playerId: string): void {
    this.requireHost(playerId);
    if (this.phase !== GamePhase.WAITING) throw new GameError(ErrorCode.INVALID_STATE);
    const players = this.activePlayers();
    const { impostorCount } = this.settings;
    if (players.length < this.minPlayers) throw new GameError(ErrorCode.NOT_ENOUGH_PLAYERS);
    // Impostors must start strictly outnumbered by the crew.
    if (players.length - impostorCount <= impostorCount)
      throw new GameError(ErrorCode.NOT_ENOUGH_PLAYERS);

    const shuffled = shuffle(players, this.rng);
    const taskPool = this.map.tasks.map((t) => t.id);
    const now = this.now();

    shuffled.forEach((p, i) => {
      p.role = i < impostorCount ? Role.IMPOSTOR : Role.CREWMATE;
      p.alive = true;
      p.deathKnown = false;
      p.tasks = shuffle(taskPool, this.rng)
        .slice(0, Math.min(this.settings.tasksPerPlayer, taskPool.length))
        .map((id) => ({ id, done: false }));
      p.activeTask = null;
      p.emergencyLeft = this.settings.emergencyMeetings;
      p.killReadyAt = 0;
      p.kills = 0;
      p.tasksCompleted = 0;
      p.input = { ...IDLE_INPUT };
    });
    this.placeAtSpawns();

    this.bodies = [];
    this.meeting = null;
    this.result = null;
    this.sabotage = null;
    this.gameOver = null;
    this.stats = { meetings: 0, ejections: 0, sabotages: 0 };
    this.matchStartedAt = now;
    this.startingEndsAt = now + STARTING_COUNTDOWN_MS;
    this.phase = GamePhase.STARTING;
    this.changed();
  }

  returnToLobby(playerId: string): void {
    this.requireHost(playerId);
    if (this.phase !== GamePhase.FINISHED) throw new GameError(ErrorCode.INVALID_STATE);
    for (const p of [...this.players.values()]) {
      if (p.left) {
        this.players.delete(p.id);
        continue;
      }
      p.role = null;
      p.alive = true;
      p.deathKnown = false;
      p.tasks = [];
      p.activeTask = null;
      p.kills = 0;
      p.tasksCompleted = 0;
    }
    this.placeAtSpawns();
    this.gameOver = null;
    this.bodies = [];
    this.phase = GamePhase.WAITING;
    this.changed();
  }

  // ------------------------------------------------------------- gameplay

  handleInput(playerId: string, input: MoveInput & { seq: number }): void {
    const p = this.getPlayer(playerId);
    if (!p || this.phase !== GamePhase.PLAYING) return;
    if (input.seq <= p.lastInputSeq) return; // stale / replayed packet
    p.lastInputSeq = input.seq;
    p.input = { up: input.up, down: input.down, left: input.left, right: input.right };
  }

  startTask(playerId: string, taskId: string): void {
    const p = this.requireAlivePlaying(playerId);
    const task = this.ownTask(p, taskId);
    if (p.role !== Role.CREWMATE) throw new GameError(ErrorCode.NOT_ALLOWED);
    if (task.done) throw new GameError(ErrorCode.ALREADY_DONE);
    this.requireNear(p, this.mapTask(taskId), INTERACT_RANGE);
    p.activeTask = { id: taskId, startedAt: this.now() };
    p.input = { ...IDLE_INPUT };
    this.changed();
  }

  cancelTask(playerId: string): void {
    const p = this.requirePlayer(playerId);
    if (p.activeTask) {
      p.activeTask = null;
      this.changed();
    }
  }

  completeTask(playerId: string, taskId: string): void {
    const p = this.requireAlivePlaying(playerId);
    const task = this.ownTask(p, taskId);
    const mapTask = this.mapTask(taskId);
    if (p.role !== Role.CREWMATE) throw new GameError(ErrorCode.NOT_ALLOWED);
    if (task.done) throw new GameError(ErrorCode.ALREADY_DONE);
    if (!p.activeTask || p.activeTask.id !== taskId) throw new GameError(ErrorCode.INVALID_STATE);
    // Anti-cheat: the mini-game cannot be finished faster than humanly possible.
    if (this.now() - p.activeTask.startedAt < TASK_MIN_DURATION_MS[mapTask.type]) {
      throw new GameError(ErrorCode.NOT_ALLOWED, 'Task finished too fast');
    }
    this.requireNear(p, mapTask, INTERACT_RANGE);
    task.done = true;
    p.tasksCompleted += 1;
    p.activeTask = null;
    this.checkWin();
    this.changed();
  }

  kill(killerId: string, targetId: string): void {
    const killer = this.requireAlivePlaying(killerId);
    if (killer.role !== Role.IMPOSTOR) throw new GameError(ErrorCode.NOT_ALLOWED);
    const target = this.getPlayer(targetId);
    if (!target || !target.alive || target.id === killer.id)
      throw new GameError(ErrorCode.NOT_ALLOWED);
    if (target.role === Role.IMPOSTOR) throw new GameError(ErrorCode.NOT_ALLOWED);
    const now = this.now();
    if (now < killer.killReadyAt) throw new GameError(ErrorCode.COOLDOWN);
    this.requireNear(killer, target, KILL_RANGE);

    target.alive = false;
    target.activeTask = null;
    target.input = { ...IDLE_INPUT };
    this.bodies.push({ ownerId: target.id, x: target.x, y: target.y });
    // Killer snaps onto the victim — a classic tell for witnesses.
    killer.x = target.x;
    killer.y = target.y;
    killer.kills += 1;
    killer.killReadyAt = now + this.settings.killCooldownSec * 1000;

    this.listener.onNotice(target.id, { type: 'KILLED', byImpostor: true });
    this.listener.onNotice(killer.id, { type: 'KILL_CONFIRMED', victimId: target.id });
    this.checkWin();
    this.changed();
  }

  reportBody(reporterId: string, bodyOwnerId: string): void {
    const reporter = this.requireAlivePlaying(reporterId);
    const body = this.bodies.find((b) => b.ownerId === bodyOwnerId);
    if (!body) throw new GameError(ErrorCode.NOT_ALLOWED);
    this.requireNear(reporter, body, REPORT_RANGE);
    this.startMeeting(MeetingReason.BODY, reporter.id, body.ownerId);
  }

  callEmergency(playerId: string): void {
    const p = this.requireAlivePlaying(playerId);
    if (p.emergencyLeft <= 0)
      throw new GameError(ErrorCode.NOT_ALLOWED, 'No emergency meetings left');
    if (this.sabotage) throw new GameError(ErrorCode.NOT_ALLOWED, 'Fix the sabotage first');
    this.requireNear(p, this.map.emergencyButton, INTERACT_RANGE);
    p.emergencyLeft -= 1;
    this.startMeeting(MeetingReason.EMERGENCY, p.id, null);
  }

  vote(voterId: string, targetId: string | null): void {
    const voter = this.requirePlayer(voterId);
    const meeting = this.meeting;
    if (this.phase !== GamePhase.MEETING || !meeting) throw new GameError(ErrorCode.INVALID_STATE);
    if (meeting.stage !== MeetingStage.VOTING)
      throw new GameError(ErrorCode.INVALID_STATE, 'Voting has not started');
    if (!voter.alive) throw new GameError(ErrorCode.NOT_ALLOWED, 'Dead players cannot vote');
    if (meeting.votes.has(voter.id)) throw new GameError(ErrorCode.ALREADY_DONE);
    if (targetId !== null) {
      const target = this.getPlayer(targetId);
      if (!target || !target.alive) throw new GameError(ErrorCode.NOT_ALLOWED);
    }
    meeting.votes.set(voter.id, targetId);
    this.maybeFinishVoting();
    this.changed();
  }

  chat(playerId: string, text: string): void {
    const p = this.requirePlayer(playerId);
    if (this.phase !== GamePhase.MEETING) throw new GameError(ErrorCode.INVALID_STATE);
    if (!p.alive) throw new GameError(ErrorCode.NOT_ALLOWED, 'Dead players cannot talk');
    this.listener.onChat({
      id: ++this.chatCounter,
      playerId: p.id,
      name: p.name,
      color: p.color,
      text,
    });
  }

  triggerSabotage(playerId: string, type: SabotageType): void {
    const p = this.requireAlivePlaying(playerId);
    if (p.role !== Role.IMPOSTOR) throw new GameError(ErrorCode.NOT_ALLOWED);
    if (this.sabotage) throw new GameError(ErrorCode.INVALID_STATE, 'Sabotage already active');
    const now = this.now();
    if (now < this.sabotageReadyAt) throw new GameError(ErrorCode.COOLDOWN);
    this.sabotage = {
      type,
      endsAt: type === SabotageType.REACTOR ? now + REACTOR_MELTDOWN_MS : null,
      fixed: new Set(),
    };
    this.sabotageReadyAt = now + SABOTAGE_COOLDOWN_MS;
    this.stats.sabotages += 1;
    this.changed();
  }

  fixSabotage(playerId: string, stationId: string): void {
    const p = this.requireAlivePlaying(playerId);
    const sabotage = this.sabotage;
    const station = this.map.sabotageStations.find((s) => s.id === stationId);
    if (!sabotage || !station || station.sabotage !== sabotage.type)
      throw new GameError(ErrorCode.INVALID_STATE);
    this.requireNear(p, station, INTERACT_RANGE);
    sabotage.fixed.add(stationId);
    const required = this.map.sabotageStations.filter((s) => s.sabotage === sabotage.type);
    if (required.every((s) => sabotage.fixed.has(s.id))) {
      this.sabotage = null;
      this.sabotageReadyAt = Math.max(this.sabotageReadyAt, this.now() + SABOTAGE_COOLDOWN_MS);
    }
    this.changed();
  }

  // ----------------------------------------------------------------- tick

  /** Advances the simulation. Called by RoomManager at SERVER_TICK_RATE. */
  tick(): void {
    const now = this.now();
    const dtMs = Math.min(250, Math.max(0, now - this.lastTickAt)); // clamp after stalls
    this.lastTickAt = now;
    this.tickCount += 1;

    this.cleanupDisconnected(now);

    switch (this.phase) {
      case GamePhase.STARTING:
        if (now >= this.startingEndsAt) {
          for (const p of this.activePlayers()) {
            if (p.role === Role.IMPOSTOR) {
              p.killReadyAt =
                now + Math.min(INITIAL_KILL_COOLDOWN_MS, this.settings.killCooldownSec * 1000);
            }
          }
          this.sabotageReadyAt = now + INITIAL_KILL_COOLDOWN_MS;
          this.phase = GamePhase.PLAYING;
          this.changed();
        }
        break;
      case GamePhase.PLAYING:
        this.simulateMovement(dtMs);
        if (this.sabotage?.endsAt && now >= this.sabotage.endsAt) {
          this.finish(Team.IMPOSTORS, WinReason.REACTOR_MELTDOWN);
        }
        break;
      case GamePhase.MEETING:
        if (this.meeting && now >= this.meeting.stageEndsAt) {
          if (this.meeting.stage === MeetingStage.DISCUSSION) {
            this.meeting.stage = MeetingStage.VOTING;
            this.meeting.stageEndsAt = now + this.settings.votingSec * 1000;
            this.changed();
          } else {
            this.finishVoting();
          }
        }
        break;
      case GamePhase.RESULT:
        if (this.result && now >= this.result.endsAt) this.afterResult();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- views

  /** Builds the private view for one player. Never leaks other players' secrets. */
  viewFor(viewerId: string): RoomView {
    const viewer = this.requirePlayer(viewerId);
    const now = this.now();
    const finished = this.phase === GamePhase.FINISHED;
    const viewerIsImpostor = viewer.role === Role.IMPOSTOR;
    const canSeeAllDeaths = !viewer.alive || finished;

    const meeting = this.meeting;
    const result = this.result;
    const sabotage = this.sabotage;

    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      settings: { ...this.settings },
      minPlayers: this.minPlayers,
      players: (finished
        ? [...this.players.values()].filter((p) => p.role)
        : this.activePlayers()
      ).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isHost: p.id === this.hostId,
        connected: p.connected,
        isDead:
          this.phase !== GamePhase.WAITING &&
          !p.alive &&
          (p.deathKnown || canSeeAllDeaths || p.id === viewer.id),
      })),
      you: {
        id: viewer.id,
        role: viewer.role,
        alive: viewer.alive,
        tasks: viewer.tasks.map((t) => ({ ...t })),
        fakeTasks: viewerIsImpostor,
        emergencyLeft: viewer.emergencyLeft,
        killCooldownMs: viewerIsImpostor ? Math.max(0, viewer.killReadyAt - now) : null,
        sabotageCooldownMs: viewerIsImpostor ? Math.max(0, this.sabotageReadyAt - now) : null,
        activeTaskId: viewer.activeTask?.id ?? null,
      },
      impostorIds:
        viewerIsImpostor || finished
          ? [...this.players.values()].filter((p) => p.role === Role.IMPOSTOR).map((p) => p.id)
          : [],
      taskProgress: this.taskProgress(),
      startingRemainingMs:
        this.phase === GamePhase.STARTING ? Math.max(0, this.startingEndsAt - now) : null,
      meeting: meeting
        ? {
            reason: meeting.reason,
            calledById: meeting.calledById,
            bodyOwnerId: meeting.bodyOwnerId,
            stage: meeting.stage,
            stageRemainingMs: Math.max(0, meeting.stageEndsAt - now),
            votedIds: [...meeting.votes.keys()],
            yourVote: meeting.votes.has(viewer.id)
              ? (meeting.votes.get(viewer.id) ?? null)
              : undefined,
          }
        : null,
      result: result
        ? {
            ejectedId: result.ejectedId,
            ejectedWasImpostor: result.ejectedWasImpostor,
            tie: result.tie,
            votes: result.votes,
            skipVoterIds: result.skipVoterIds,
            remainingMs: Math.max(0, result.endsAt - now),
          }
        : null,
      sabotage: sabotage
        ? {
            type: sabotage.type,
            remainingMs: sabotage.endsAt ? Math.max(0, sabotage.endsAt - now) : null,
            fixedStationIds: [...sabotage.fixed],
          }
        : null,
      gameOver: this.gameOver,
    };
  }

  /** Positions for one viewer. The living never receive ghost positions. */
  snapshotFor(viewerId: string): WorldSnapshot {
    const viewer = this.requirePlayer(viewerId);
    const players = this.activePlayers()
      .filter((p) => p.alive || !viewer.alive)
      .map((p) => ({
        id: p.id,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        moving: p.alive || !viewer.alive ? isMoving(p.input) : false,
        facing: p.facing,
        ghost: !p.alive,
      }));
    return {
      tick: this.tickCount,
      players,
      bodies: this.bodies.map((b) => ({ ...b })),
      ackSeq: viewer.lastInputSeq,
    };
  }

  // -------------------------------------------------------------- internals

  private changed(): void {
    this.listener.onStateChanged();
  }

  private activePlayers(): PlayerState[] {
    return [...this.players.values()].filter((p) => !p.left);
  }

  private isRunning(): boolean {
    return (
      this.phase === GamePhase.PLAYING ||
      this.phase === GamePhase.MEETING ||
      this.phase === GamePhase.RESULT
    );
  }

  private requirePlayer(id: string): PlayerState {
    const p = this.getPlayer(id);
    if (!p) throw new GameError(ErrorCode.NOT_IN_ROOM);
    return p;
  }

  private requireHost(id: string): PlayerState {
    const p = this.requirePlayer(id);
    if (p.id !== this.hostId) throw new GameError(ErrorCode.NOT_HOST);
    return p;
  }

  private requireAlivePlaying(id: string): PlayerState {
    const p = this.requirePlayer(id);
    if (this.phase !== GamePhase.PLAYING) throw new GameError(ErrorCode.INVALID_STATE);
    if (!p.alive) throw new GameError(ErrorCode.NOT_ALLOWED, 'Dead players cannot do that');
    return p;
  }

  private requireNear(p: PlayerState, target: Vector2, range: number): void {
    if (distance(p, target) > range) throw new GameError(ErrorCode.TOO_FAR);
  }

  private ownTask(p: PlayerState, taskId: string) {
    const task = p.tasks.find((t) => t.id === taskId);
    if (!task) throw new GameError(ErrorCode.NOT_ALLOWED, 'Not your task');
    return task;
  }

  private mapTask(taskId: string) {
    const task = this.map.tasks.find((t) => t.id === taskId);
    if (!task) throw new GameError(ErrorCode.NOT_ALLOWED);
    return task;
  }

  private uniqueName(name: string, selfId?: string): string {
    const taken = new Set(
      this.activePlayers()
        .filter((p) => p.id !== selfId)
        .map((p) => p.name.toLowerCase()),
    );
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) {
      const candidate = `${name.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private pickColor(requested: PlayerColor | undefined): PlayerColor {
    const taken = new Set(this.activePlayers().map((p) => p.color));
    if (requested && !taken.has(requested)) return requested;
    const free = PLAYER_COLORS.find((c) => !taken.has(c));
    if (!free) throw new GameError(ErrorCode.ROOM_FULL);
    return free;
  }

  private spawnFor(index: number): Vector2 {
    const spawn = this.map.spawns[index % this.map.spawns.length]!;
    return { x: spawn.x, y: spawn.y };
  }

  private placeAtSpawns(): void {
    this.activePlayers().forEach((p, i) => {
      const s = this.spawnFor(i);
      p.x = s.x;
      p.y = s.y;
      p.input = { ...IDLE_INPUT };
    });
  }

  private migrateHost(): void {
    const next = this.activePlayers().find((p) => p.connected) ?? this.activePlayers()[0];
    this.hostId = next?.id ?? '';
    if (next) this.listener.onNotice(null, { type: 'HOST_CHANGED', hostId: next.id });
  }

  /**
   * Removes everyone whose reconnection grace period expired — as one batch, so the
   * win check sees the final roster (e.g. crew + impostor timing out in the same tick).
   */
  private cleanupDisconnected(now: number): void {
    const grace =
      this.phase === GamePhase.WAITING ? LOBBY_DISCONNECT_GRACE_MS : GAME_DISCONNECT_GRACE_MS;
    let removed = false;
    for (const p of this.activePlayers()) {
      if (!p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= grace) {
        removed = this.markRemoved(p.id) || removed;
      }
    }
    if (removed) this.afterRemoval();
  }

  /** Returns false if the player was already gone. Does not evaluate win conditions. */
  private markRemoved(playerId: string): boolean {
    const p = this.players.get(playerId);
    if (!p || p.left) return false;
    if (this.phase === GamePhase.WAITING) {
      this.players.delete(playerId);
    } else {
      p.left = true;
      p.connected = false;
      p.alive = false;
      p.deathKnown = true;
      p.input = { ...IDLE_INPUT };
      p.activeTask = null;
      if (this.meeting) this.meeting.votes.delete(playerId);
    }
    this.listener.onPlayerRemoved(playerId);
    this.listener.onNotice(null, { type: 'PLAYER_LEFT', playerId, name: p.name });
    return true;
  }

  private afterRemoval(): void {
    if (!this.getPlayer(this.hostId)) this.migrateHost();
    if (this.isRunning()) this.checkWin();
    if (this.phase === GamePhase.MEETING) this.maybeFinishVoting();
    this.changed();
  }

  private simulateMovement(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const p of this.activePlayers()) {
      if (p.activeTask || !p.connected) continue;
      const v = getVelocity(p.input);
      if (v.x === 0 && v.y === 0) continue;
      if (v.x !== 0) p.facing = v.x > 0 ? 1 : -1;
      if (p.alive) {
        const next = moveWithCollision(this.map.grid, p, v.x * dt, v.y * dt);
        p.x = next.x;
        p.y = next.y;
      } else {
        // Ghosts float through walls but stay inside the map.
        p.x = Math.min(this.map.widthPx - 16, Math.max(16, p.x + v.x * dt));
        p.y = Math.min(this.map.heightPx - 16, Math.max(16, p.y + v.y * dt));
      }
    }
  }

  private taskProgress(): { done: number; total: number } {
    let done = 0;
    let total = 0;
    for (const p of this.players.values()) {
      if (p.role !== Role.CREWMATE) continue;
      for (const t of p.tasks) {
        if (t.done) {
          done += 1;
          total += 1;
        } else if (p.alive && !p.left) {
          // Tasks of dead crewmates are dropped, so a task win stays possible.
          total += 1;
        }
      }
    }
    return { done, total };
  }

  private startMeeting(
    reason: MeetingReason,
    calledById: string,
    bodyOwnerId: string | null,
  ): void {
    const now = this.now();
    for (const p of this.players.values()) {
      if (!p.alive) p.deathKnown = true;
      p.input = { ...IDLE_INPUT };
      p.activeTask = null;
    }
    this.sabotage = null;
    this.stats.meetings += 1;
    const discussionMs = this.settings.discussionSec * 1000;
    this.meeting = {
      reason,
      calledById,
      bodyOwnerId,
      stage: discussionMs > 0 ? MeetingStage.DISCUSSION : MeetingStage.VOTING,
      stageEndsAt: now + (discussionMs > 0 ? discussionMs : this.settings.votingSec * 1000),
      votes: new Map(),
    };
    this.phase = GamePhase.MEETING;
    this.changed();
  }

  private maybeFinishVoting(): void {
    const meeting = this.meeting;
    if (!meeting || meeting.stage !== MeetingStage.VOTING) return;
    const voters = this.activePlayers().filter((p) => p.alive);
    if (voters.every((p) => meeting.votes.has(p.id))) this.finishVoting();
  }

  /** Plurality vote: a unique top target with more votes than "skip" is ejected. */
  private finishVoting(): void {
    const meeting = this.meeting;
    if (!meeting) return;
    const votes: Record<string, string[]> = {};
    const skipVoterIds: string[] = [];
    for (const [voterId, targetId] of meeting.votes) {
      if (targetId === null) skipVoterIds.push(voterId);
      else (votes[targetId] ??= []).push(voterId);
    }
    const ranking = Object.entries(votes).sort((a, b) => b[1].length - a[1].length);
    const top = ranking[0];
    const second = ranking[1];
    const tie = !!top && !!second && top[1].length === second[1].length;
    let ejectedId: string | null = null;
    if (top && !tie && top[1].length > skipVoterIds.length) ejectedId = top[0];

    let ejectedWasImpostor: boolean | null = null;
    if (ejectedId) {
      const ejected = this.players.get(ejectedId);
      if (ejected) {
        ejected.alive = false;
        ejected.deathKnown = true;
        this.stats.ejections += 1;
        if (this.settings.confirmEjects) ejectedWasImpostor = ejected.role === Role.IMPOSTOR;
      }
    }

    this.meeting = null;
    this.bodies = [];
    this.result = {
      ejectedId,
      ejectedWasImpostor,
      tie: tie || (!!top && top[1].length === skipVoterIds.length && skipVoterIds.length > 0),
      votes,
      skipVoterIds,
      endsAt: this.now() + RESULT_DURATION_MS,
    };
    this.phase = GamePhase.RESULT;
    this.changed();
  }

  private afterResult(): void {
    this.result = null;
    if (this.checkWin()) return;
    const now = this.now();
    this.placeAtSpawns();
    for (const p of this.activePlayers()) {
      if (p.role === Role.IMPOSTOR) p.killReadyAt = now + this.settings.killCooldownSec * 1000;
    }
    this.sabotageReadyAt = Math.max(this.sabotageReadyAt, now + INITIAL_KILL_COOLDOWN_MS);
    this.phase = GamePhase.PLAYING;
    this.changed();
  }

  /** Returns true if the game ended. During RESULT, the win is applied after the ejection screen. */
  private checkWin(): boolean {
    if (!this.isRunning()) return false;
    const present = [...this.players.values()].filter((p) => !p.left && p.alive);
    const impostors = present.filter((p) => p.role === Role.IMPOSTOR).length;
    const crew = present.filter((p) => p.role === Role.CREWMATE).length;
    const progress = this.taskProgress();

    let outcome: [Team, WinReason] | null = null;
    if (impostors === 0) outcome = [Team.CREW, WinReason.IMPOSTORS_ELIMINATED];
    else if (impostors >= crew) outcome = [Team.IMPOSTORS, WinReason.CREW_OUTNUMBERED];
    else if (progress.total > 0 && progress.done >= progress.total)
      outcome = [Team.CREW, WinReason.TASKS];

    if (!outcome) return false;
    if (this.phase === GamePhase.RESULT && this.result) return false; // shown after the ejection screen
    this.finish(outcome[0], outcome[1]);
    return true;
  }

  private finish(winner: Team, reason: WinReason): void {
    const roles: Record<string, Role> = {};
    for (const p of this.players.values()) if (p.role) roles[p.id] = p.role;
    this.gameOver = { winner, reason, roles };
    this.phase = GamePhase.FINISHED;
    this.meeting = null;
    this.result = null;
    this.sabotage = null;
    for (const p of this.players.values()) p.input = { ...IDLE_INPUT };

    const winningRole = winner === Team.CREW ? Role.CREWMATE : Role.IMPOSTOR;
    this.listener.onMatchFinished({
      roomCode: this.code,
      startedAt: new Date(this.matchStartedAt),
      endedAt: new Date(this.now()),
      winner,
      reason,
      impostorCount: this.settings.impostorCount,
      ...this.stats,
      participants: [...this.players.values()]
        .filter((p) => p.role)
        .map((p) => ({
          userId: p.userId,
          name: p.name,
          color: p.color,
          role: p.role!,
          won: p.role === winningRole,
          survived: p.alive && !p.left,
          tasksCompleted: p.tasksCompleted,
          kills: p.kills,
        })),
    });
    this.changed();
  }
}
