import type { ErrorCode } from '@stellar/shared';

/** Expected rule violation (not a bug). Handlers turn it into `{ ok: false, error }`. */
export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GameError';
  }
}
