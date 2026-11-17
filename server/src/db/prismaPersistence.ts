import { PrismaPg } from '@prisma/adapter-pg';
import { playerColorSchema, type PlayerColor, type Role } from '@stellar/shared';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { MatchSummary } from '../game/GameRoom.js';
import { UsernameTakenError, type Persistence, type PublicProfile } from './types.js';

const asColor = (value: string): PlayerColor => {
  const parsed = playerColorSchema.safeParse(value);
  return parsed.success ? parsed.data : 'cyan';
};

/** PostgreSQL implementation via Prisma 7 + the `pg` driver adapter. */
export function createPrismaPersistence(databaseUrl: string): Persistence {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  const toPublic = (row: {
    username: string;
    createdAt: Date;
    profile: {
      displayName: string;
      preferredColor: string;
      gamesPlayed: number;
      gamesWon: number;
      tasksCompleted: number;
    } | null;
  }): PublicProfile => ({
    username: row.username,
    displayName: row.profile?.displayName ?? row.username,
    preferredColor: asColor(row.profile?.preferredColor ?? 'cyan'),
    gamesPlayed: row.profile?.gamesPlayed ?? 0,
    gamesWon: row.profile?.gamesWon ?? 0,
    tasksCompleted: row.profile?.tasksCompleted ?? 0,
    memberSince: row.createdAt.toISOString(),
  });

  return {
    kind: 'postgres',
    users: {
      async create({ username, passwordHash, displayName }) {
        try {
          return await prisma.user.create({
            data: { username, passwordHash, profile: { create: { displayName } } },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new UsernameTakenError();
          }
          throw err;
        }
      },
      findByUsername: (username) =>
        prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } }),
      findById: (id) => prisma.user.findUnique({ where: { id } }),
      async getPublicProfile(username) {
        const row = await prisma.user.findFirst({
          where: { username: { equals: username, mode: 'insensitive' } },
          select: { username: true, createdAt: true, profile: true },
        });
        return row ? toPublic(row) : null;
      },
      async getRecentMatches(userId, limit) {
        const rows = await prisma.matchParticipant.findMany({
          where: { profile: { userId } },
          include: { match: true },
          orderBy: { match: { endedAt: 'desc' } },
          take: limit,
        });
        return rows.map((r) => ({
          matchId: r.matchId,
          endedAt: r.match.endedAt.toISOString(),
          role: r.role as Role,
          won: r.won,
          survived: r.survived,
          tasksCompleted: r.tasksCompleted,
          kills: r.kills,
          winner: r.match.winner,
          playerCount: r.match.playerCount,
        }));
      },
      async updatePreferences(userId, prefs) {
        await prisma.playerProfile.update({
          where: { userId },
          data: {
            ...(prefs.displayName ? { displayName: prefs.displayName } : {}),
            ...(prefs.preferredColor ? { preferredColor: prefs.preferredColor } : {}),
          },
        });
      },
      async leaderboard(limit) {
        const rows = await prisma.user.findMany({
          where: { profile: { gamesPlayed: { gt: 0 } } },
          select: { username: true, createdAt: true, profile: true },
          orderBy: [{ profile: { gamesWon: 'desc' } }, { profile: { gamesPlayed: 'desc' } }],
          take: limit,
        });
        return rows.map(toPublic);
      },
    },
    matches: {
      async record(summary: MatchSummary) {
        const userIds = summary.participants.flatMap((p) => (p.userId ? [p.userId] : []));
        await prisma.$transaction(async (tx) => {
          const profiles = await tx.playerProfile.findMany({ where: { userId: { in: userIds } } });
          const profileByUser = new Map(profiles.map((p) => [p.userId, p.id]));

          await tx.match.create({
            data: {
              roomCode: summary.roomCode,
              startedAt: summary.startedAt,
              endedAt: summary.endedAt,
              winner: summary.winner,
              winReason: summary.reason,
              playerCount: summary.participants.length,
              impostorCount: summary.impostorCount,
              participants: {
                create: summary.participants.map((p) => ({
                  profileId: (p.userId && profileByUser.get(p.userId)) || null,
                  displayName: p.name,
                  color: p.color,
                  role: p.role,
                  won: p.won,
                  survived: p.survived,
                  tasksCompleted: p.tasksCompleted,
                  kills: p.kills,
                })),
              },
              statistics: {
                create: {
                  durationSec: Math.round(
                    (summary.endedAt.getTime() - summary.startedAt.getTime()) / 1000,
                  ),
                  totalKills: summary.participants.reduce((n, p) => n + p.kills, 0),
                  meetings: summary.meetings,
                  ejections: summary.ejections,
                  tasksCompleted: summary.participants.reduce((n, p) => n + p.tasksCompleted, 0),
                  sabotages: summary.sabotages,
                },
              },
            },
          });

          for (const p of summary.participants) {
            const profileId = p.userId ? profileByUser.get(p.userId) : undefined;
            if (!profileId) continue;
            await tx.playerProfile.update({
              where: { id: profileId },
              data: {
                gamesPlayed: { increment: 1 },
                gamesWon: { increment: p.won ? 1 : 0 },
                tasksCompleted: { increment: p.tasksCompleted },
              },
            });
          }
        });
      },
    },
    close: () => prisma.$disconnect(),
  };
}
