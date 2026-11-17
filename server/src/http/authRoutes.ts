import { Router, type Request } from 'express';
import {
  loginSchema,
  playerColorSchema,
  playerNameSchema,
  registerSchema,
  usernameSchema,
} from '@stellar/shared';
import { z } from 'zod';
import type { AuthService } from '../auth/AuthService.js';
import { UsernameTakenError, type Persistence } from '../db/types.js';
import { rateLimit } from './rateLimit.js';

export interface AuthResponse {
  token: string;
  user: { id: string; username: string };
}

const preferencesSchema = z.strictObject({
  displayName: playerNameSchema.optional(),
  preferredColor: playerColorSchema.optional(),
});

/** REST: registration, login, profiles, leaderboard. All input validated with Zod. */
export function createAuthRouter(auth: AuthService, persistence: Persistence): Router {
  const router = Router();
  const authLimiter = rateLimit(10, 0.2); // 10 attempts burst, then 1 per 5 s per IP

  const currentUserId = (req: Request): string | null => {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? auth.verifyToken(header.slice(7)) : null;
  };

  router.post('/auth/register', authLimiter, async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success)
        return void res
          .status(400)
          .json({ error: 'VALIDATION_FAILED', details: z.flattenError(parsed.error) });
      const { username, password, displayName } = parsed.data;
      const user = await persistence.users.create({
        username,
        passwordHash: await auth.hashPassword(password),
        displayName: displayName ?? username,
      });
      const body: AuthResponse = {
        token: auth.issueToken(user.id),
        user: { id: user.id, username: user.username },
      };
      res.status(201).json(body);
    } catch (err) {
      if (err instanceof UsernameTakenError)
        return void res.status(409).json({ error: 'USERNAME_TAKEN' });
      next(err);
    }
  });

  router.post('/auth/login', authLimiter, async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return void res.status(400).json({ error: 'VALIDATION_FAILED' });
      const user = await persistence.users.findByUsername(parsed.data.username);
      // Same error for unknown user and wrong password: no account enumeration.
      const valid = user
        ? await auth.verifyPassword(parsed.data.password, user.passwordHash)
        : false;
      if (!user || !valid) return void res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      const body: AuthResponse = {
        token: auth.issueToken(user.id),
        user: { id: user.id, username: user.username },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile/me', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      const user = userId ? await persistence.users.findById(userId) : null;
      if (!user) return void res.status(401).json({ error: 'UNAUTHORIZED' });
      const [profile, matches] = await Promise.all([
        persistence.users.getPublicProfile(user.username),
        persistence.users.getRecentMatches(user.id, 10),
      ]);
      res.json({ profile, matches });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/profile/me', async (req, res, next) => {
    try {
      const userId = currentUserId(req);
      if (!userId) return void res.status(401).json({ error: 'UNAUTHORIZED' });
      const parsed = preferencesSchema.safeParse(req.body);
      if (!parsed.success) return void res.status(400).json({ error: 'VALIDATION_FAILED' });
      await persistence.users.updatePreferences(userId, {
        ...(parsed.data.displayName ? { displayName: parsed.data.displayName } : {}),
        ...(parsed.data.preferredColor ? { preferredColor: parsed.data.preferredColor } : {}),
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** Public profile: never includes roles. */
  router.get('/profiles/:username', async (req, res, next) => {
    try {
      const parsed = usernameSchema.safeParse(req.params.username);
      if (!parsed.success) return void res.status(400).json({ error: 'VALIDATION_FAILED' });
      const profile = await persistence.users.getPublicProfile(parsed.data);
      if (!profile) return void res.status(404).json({ error: 'NOT_FOUND' });
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  router.get('/leaderboard', async (_req, res, next) => {
    try {
      res.json(await persistence.users.leaderboard(10));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
