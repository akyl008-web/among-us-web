import { ErrorCode, pingPayloadSchema } from '@stellar/shared';
import type { RateLimiter } from '../rateLimiter.js';
import type { GameSocket } from '../types.js';

/**
 * Pattern for every handler: rate-limit → validate with Zod → act → ack.
 * Never trust the raw payload or the ack argument type.
 */
export function registerSystemHandlers(socket: GameSocket, limiter: RateLimiter): void {
  socket.on('system:ping', (payload, ack) => {
    if (typeof ack !== 'function') return; // malformed emit without callback

    if (!limiter.tryConsume(`${socket.id}:system:ping`)) {
      ack({ ok: false, error: ErrorCode.RATE_LIMITED });
      return;
    }

    const parsed = pingPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      ack({ ok: false, error: ErrorCode.VALIDATION_FAILED });
      return;
    }

    ack({ ok: true, data: { clientTime: parsed.data.clientTime, serverTime: Date.now() } });
  });
}
