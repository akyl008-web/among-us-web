import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env automatically.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` works without a database; migrate/studio need a real URL.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/stellar_suspects',
  },
});
