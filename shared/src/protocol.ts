import type { GamePhase, PlayerColor, Role } from './game.js';

export const TaskType = { WIRES: 'WIRES', HOLD: 'HOLD', SEQUENCE: 'SEQUENCE' } as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const SabotageType = { LIGHTS: 'LIGHTS', REACTOR: 'REACTOR' } as const;
export type SabotageType = (typeof SabotageType)[keyof typeof SabotageType];

export const MeetingReason = { EMERGENCY: 'EMERGENCY', BODY: 'BODY' } as const;
export type MeetingReason = (typeof MeetingReason)[keyof typeof MeetingReason];

export const MeetingStage = { DISCUSSION: 'DISCUSSION', VOTING: 'VOTING' } as const;
export type MeetingStage = (typeof MeetingStage)[keyof typeof MeetingStage];

export const Team = { CREW: 'CREW', IMPOSTORS: 'IMPOSTORS' } as const;
export type Team = (typeof Team)[keyof typeof Team];

export const WinReason = {
  TASKS: 'TASKS',
  IMPOSTORS_ELIMINATED: 'IMPOSTORS_ELIMINATED',
  CREW_OUTNUMBERED: 'CREW_OUTNUMBERED',
  REACTOR_MELTDOWN: 'REACTOR_MELTDOWN',
} as const;
export type WinReason = (typeof WinReason)[keyof typeof WinReason];

export interface RoomSettings {
  impostorCount: number;
  killCooldownSec: number;
  tasksPerPlayer: number;
  discussionSec: number;
  votingSec: number;
  emergencyMeetings: number;
  confirmEjects: boolean;
}

export const DEFAULT_ROOM_SETTINGS: Readonly<RoomSettings> = Object.freeze({
  impostorCount: 1,
  killCooldownSec: 25,
  tasksPerPlayer: 4,
  discussionSec: 30,
  votingSec: 30,
  emergencyMeetings: 1,
  confirmEjects: true,
});

/** Returned after create/join/reconnect. Store it to reconnect after a page reload. */
export interface JoinedRoom {
  code: string;
  playerId: string;
  sessionToken: string;
}

/** What every player may know about another player. */
export interface PublicPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  connected: boolean;
  /** Death known to the viewer (always true for the viewer if they are a ghost). */
  isDead: boolean;
}

export interface OwnTask {
  id: string;
  done: boolean;
}

/** Private part of the view: only ever sent to that player. */
export interface SelfView {
  id: string;
  role: Role | null;
  alive: boolean;
  tasks: OwnTask[];
  /** Impostors get decoy tasks that can't be completed. */
  fakeTasks: boolean;
  emergencyLeft: number;
  killCooldownMs: number | null;
  sabotageCooldownMs: number | null;
  activeTaskId: string | null;
}

export interface MeetingView {
  reason: MeetingReason;
  calledById: string;
  bodyOwnerId: string | null;
  stage: MeetingStage;
  stageRemainingMs: number;
  /** Who has voted (not for whom — that stays secret until the result). */
  votedIds: string[];
  yourVote: string | null | undefined; // undefined = not voted, null = skip
}

export interface MeetingResultView {
  ejectedId: string | null;
  /** null when confirmEjects is off or nobody was ejected. */
  ejectedWasImpostor: boolean | null;
  tie: boolean;
  votes: Record<string, string[]>; // targetId -> voterIds
  skipVoterIds: string[];
  remainingMs: number;
}

export interface SabotageView {
  type: SabotageType;
  remainingMs: number | null; // null = not critical
  fixedStationIds: string[];
}

export interface GameOverView {
  winner: Team;
  reason: WinReason;
  roles: Record<string, Role>;
}

/** Full per-player room state. Built on the server for each viewer separately. */
export interface RoomView {
  code: string;
  phase: GamePhase;
  hostId: string;
  settings: RoomSettings;
  minPlayers: number;
  players: PublicPlayer[];
  you: SelfView;
  /** Only for impostors (their team) or after the game is over. */
  impostorIds: string[];
  taskProgress: { done: number; total: number };
  startingRemainingMs: number | null;
  meeting: MeetingView | null;
  result: MeetingResultView | null;
  sabotage: SabotageView | null;
  gameOver: GameOverView | null;
}

export interface SnapshotPlayer {
  id: string;
  x: number;
  y: number;
  moving: boolean;
  facing: 1 | -1;
  ghost: boolean;
}

export interface SnapshotBody {
  ownerId: string;
  x: number;
  y: number;
}

/** High-frequency world state (positions). Ghosts are hidden from the living. */
export interface WorldSnapshot {
  tick: number;
  players: SnapshotPlayer[];
  bodies: SnapshotBody[];
  /** Last input sequence number the server applied for the receiving player. */
  ackSeq: number;
}

export interface ChatMessage {
  id: number;
  playerId: string;
  name: string;
  color: PlayerColor;
  text: string;
}

export type GameNotice =
  | { type: 'KILLED'; byImpostor: true }
  | { type: 'KILL_CONFIRMED'; victimId: string }
  | { type: 'HOST_CHANGED'; hostId: string }
  | { type: 'PLAYER_LEFT'; playerId: string; name: string };
