import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Injectable randomness so game logic stays deterministic in tests. */
export interface Rng {
  /** Integer in [0, max). */
  int(max: number): number;
}

export const cryptoRng: Rng = { int: (max) => randomInt(max) };

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function createToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time string comparison (prevents timing attacks on session tokens). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
