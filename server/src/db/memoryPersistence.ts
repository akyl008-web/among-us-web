import { randomUUID } from 'node:crypto';
import type { PlayerColor } from '@stellar/shared';
import type { MatchSummary } from '../game/GameRoom.js';
import {
  UsernameTakenError,
  type OwnMatchEntry,
  type Persistence,
  type PublicProfile,
  type UserRecord,
} from './types.js';

interface ProfileRow {
  displayName: string;
  preferredColor: PlayerColor;
  gamesPlayed: number;
  gamesWon: number;
  tasksCompleted: number;
}

/**
 * In-memory implementation used when DATABASE_URL is not set (local dev, tests).
 * Same behaviour as Postgres, but data is lost on restart.
 */
export function createMemoryPersistence(): Persistence {
  const users = new Map<string, UserRecord>();
  const profiles = new Map<string, ProfileRow>();
  const history = new Map<string, OwnMatchEntry[]>();

  const toPublic = (user: UserRecord): PublicProfile => {
    const p = profiles.get(user.id)!;
    return { username: user.username, ...p, memberSince: user.createdAt.toISOString() };
  };
  const byUsername = (username: string) =>
    [...users.values()].find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;

  return {
    kind: 'memory',
    users: {
      async create({ username, passwordHash, displayName }) {
        if (byUsername(username)) throw new UsernameTakenError();
        const user: UserRecord = {
          id: randomUUID(),
          username,
          passwordHash,
          createdAt: new Date(),
        };
        users.set(user.id, user);
        profiles.set(user.id, {
          displayName,
          preferredColor: 'cyan',
          gamesPlayed: 0,
          gamesWon: 0,
          tasksCompleted: 0,
        });
        return user;
      },
      async findByUsername(username) {
        return byUsername(username);
      },
      async findById(id) {
        return users.get(id) ?? null;
      },
      async getPublicProfile(username) {
        const user = byUsername(username);
        return user ? toPublic(user) : null;
      },
      async getRecentMatches(userId, limit) {
        return (history.get(userId) ?? []).slice(0, limit);
      },
      async updatePreferences(userId, prefs) {
        const p = profiles.get(userId);
        if (!p) return;
        if (prefs.displayName) p.displayName = prefs.displayName;
        if (prefs.preferredColor) p.preferredColor = prefs.preferredColor;
      },
      async leaderboard(limit) {
        return [...users.values()]
          .map(toPublic)
          .sort((a, b) => b.gamesWon - a.gamesWon || b.gamesPlayed - a.gamesPlayed)
          .slice(0, limit);
      },
    },
    matches: {
      async record(summary: MatchSummary) {
        const matchId = randomUUID();
        for (const part of summary.participants) {
          if (!part.userId || !profiles.has(part.userId)) continue;
          const profile = profiles.get(part.userId)!;
          profile.gamesPlayed += 1;
          if (part.won) profile.gamesWon += 1;
          profile.tasksCompleted += part.tasksCompleted;
          const list = history.get(part.userId) ?? [];
          list.unshift({
            matchId,
            endedAt: summary.endedAt.toISOString(),
            role: part.role,
            won: part.won,
            survived: part.survived,
            tasksCompleted: part.tasksCompleted,
            kills: part.kills,
            winner: summary.winner,
            playerCount: summary.participants.length,
          });
          history.set(part.userId, list.slice(0, 50));
        }
      },
    },
    async close() {},
  };
}
