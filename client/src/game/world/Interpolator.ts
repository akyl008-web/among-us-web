import type { Vector2 } from '@stellar/shared';

interface Sample extends Vector2 {
  t: number;
}

/**
 * Smooths remote players: renders them slightly in the past (INTERP_DELAY_MS)
 * and linearly interpolates between the two surrounding server samples.
 */
export const INTERP_DELAY_MS = 100;

export class Interpolator {
  private readonly samples: Sample[] = [];

  push(x: number, y: number, t: number): void {
    this.samples.push({ x, y, t });
    if (this.samples.length > 20) this.samples.shift();
  }

  /** Position at render time `now` (ms, same clock as `push`). */
  sample(now: number): Vector2 | null {
    const s = this.samples;
    if (s.length === 0) return null;
    const target = now - INTERP_DELAY_MS;
    if (target <= s[0]!.t) return { x: s[0]!.x, y: s[0]!.y };
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1]!;
      const b = s[i]!;
      if (target >= a.t && target <= b.t) {
        const k = b.t === a.t ? 1 : (target - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    const last = s[s.length - 1]!;
    return { x: last.x, y: last.y };
  }

  reset(): void {
    this.samples.length = 0;
  }
}
