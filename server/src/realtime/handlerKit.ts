import { ErrorCode, type Ack } from '@stellar/shared';
import type { z } from 'zod';
import { GameError } from '../game/GameError.js';
import { logger } from '../lib/logger.js';
import type { RateLimiter } from './rateLimiter.js';
import type { GameSocket } from './types.js';

/** Validates a payload with Zod; throws VALIDATION_FAILED instead of trusting the client. */
export function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const result = schema.safeParse(payload);
  if (!result.success) throw new GameError(ErrorCode.VALIDATION_FAILED);
  return result.data;
}

export function toErrorAck(err: unknown): Ack<never> {
  if (err instanceof GameError) return { ok: false, error: err.code, message: err.message };
  logger.error('Unhandled socket handler error', {
    err: err instanceof Error ? err.stack : String(err),
  });
  return { ok: false, error: ErrorCode.INTERNAL };
}

/**
 * Wraps a request/response handler: rate limit → run → ack.
 * Silently ignores emits without an ack callback (malformed client).
 */
export function createResponder(socket: GameSocket, limiter: RateLimiter, afterAction: () => void) {
  return function respond<T>(event: string, ack: unknown, action: () => T | Promise<T>): void {
    if (typeof ack !== 'function') return;
    const reply = ack as (res: Ack<T | null>) => void;
    if (!limiter.tryConsume(`${socket.id}:${event}`)) {
      reply({ ok: false, error: ErrorCode.RATE_LIMITED });
      return;
    }
    Promise.resolve()
      .then(action)
      .then((data) => {
        reply({ ok: true, data: data ?? null });
        afterAction();
      })
      .catch((err: unknown) => {
        reply(toErrorAck(err));
        afterAction();
      });
  };
}
