import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { MAX_PLAYERS, MIN_PLAYERS } from '@stellar/shared';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    CLIENT_ORIGIN: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    /** Lower only for local testing (3 = minimum for 1 impostor). */
    MIN_PLAYERS: z.coerce.number().int().min(3).max(MAX_PLAYERS).default(MIN_PLAYERS),
    DATABASE_URL: z.url().optional(),
    AUTH_SECRET: z.string().min(32).optional(),
    /** Serve the built client (client/dist) from this server — used in production. */
    SERVE_CLIENT: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .refine((env) => env.NODE_ENV !== 'production' || !!env.AUTH_SECRET, {
    message: 'AUTH_SECRET is required in production',
    path: ['AUTH_SECRET'],
  })
  .transform((env) => ({
    ...env,
    // Dev convenience: a random secret means tokens reset on every restart.
    AUTH_SECRET: env.AUTH_SECRET ?? randomBytes(32).toString('hex'),
    authSecretIsEphemeral: !env.AUTH_SECRET,
  }));

export type AppConfig = z.infer<typeof envSchema>;

/** Loads `.env` (if present) and validates environment. Fails fast on bad config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  // Treat empty strings from .env templates as "not set".
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
