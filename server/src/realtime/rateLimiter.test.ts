import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimiter.js';

describe('RateLimiter', () => {
  it('allows a burst up to capacity, then refills over time', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1, () => now);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
    now = 1000;
    expect(limiter.tryConsume('a')).toBe(true);
  });

  it('keeps buckets independent per key', () => {
    const limiter = new RateLimiter(1, 0, () => 0);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
  });
});
