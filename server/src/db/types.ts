import type { PlayerColor, Role } from '@stellar/shared';
import type { MatchSummary } from '../game/GameRoom.js';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

/** Public profile: safe to show to anyone. Contains NO role information. */
export interface PublicProfile {
  username: string;
  displayName: string;
  preferredColor: PlayerColor;
  gamesPlayed: number;
  gamesWon: number;
  tasksCompleted: number;
  memberSince: string;
}

/** Owner-only match history entry (includes the role the owner played). */
export interface OwnMatchEntry {
  matchId: string;
  endedAt: string;
  role: Role;
  won: boolean;
  survived: boolean;
  tasksCompleted: number;
  kills: number;
  winner: string;
  playerCount: number;
}

export interface UserStore {
  create(input: {
    username: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecord>;
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  getPublicProfile(username: string): Promise<PublicProfile | null>;
  getRecentMatches(userId: string, limit: number): Promise<OwnMatchEntry[]>;
  updatePreferences(
    userId: string,
    prefs: { displayName?: string; preferredColor?: PlayerColor },
  ): Promise<void>;
  leaderboard(limit: number): Promise<PublicProfile[]>;
}

export interface MatchStore {
  record(summary: MatchSummary): Promise<void>;
}

/** Persistent data (users, profiles, match history). Temporary match state never goes here. */
export interface Persistence {
  kind: 'postgres' | 'memory';
  users: UserStore;
  matches: MatchStore;
  close(): Promise<void>;
}

export class UsernameTakenError extends Error {
  constructor() {
    super('Username already taken');
    this.name = 'UsernameTakenError';
  }
}
