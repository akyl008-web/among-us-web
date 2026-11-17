/**
 * Token-bucket rate limiter, one bucket per key (e.g. `${socketId}:${event}`).
 * Protects the server from event spam.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryConsume(key: string): boolean {
    const time = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: time };
    const elapsed = (time - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSecond);
    bucket.updatedAt = time;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return allowed;
  }

  /** Drop all buckets of a disconnected socket. */
  clearPrefix(prefix: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(prefix)) this.buckets.delete(key);
    }
  }
}
