import { logger } from '../lib/logger.js';
import { createMemoryPersistence } from './memoryPersistence.js';
import type { Persistence } from './types.js';

/** Postgres when DATABASE_URL is set, otherwise in-memory (so the game always runs). */
export async function createPersistence(databaseUrl: string | undefined): Promise<Persistence> {
  if (!databaseUrl) {
    logger.warn('DATABASE_URL is not set — using in-memory storage (data is lost on restart)');
    return createMemoryPersistence();
  }
  // Loaded lazily so tests and DB-less setups never touch the Prisma runtime.
  const { createPrismaPersistence } = await import('./prismaPersistence.js');
  logger.info('Using PostgreSQL persistence');
  return createPrismaPersistence(databaseUrl);
}
