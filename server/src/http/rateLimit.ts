import type { RequestHandler } from 'express';
import { RateLimiter } from '../realtime/rateLimiter.js';

/** Per-IP token bucket for sensitive REST endpoints (login/register brute force). */
export function rateLimit(capacity: number, refillPerSecond: number): RequestHandler {
  const limiter = new RateLimiter(capacity, refillPerSecond);
  return (req, res, next) => {
    if (limiter.tryConsume(req.ip ?? 'unknown')) return next();
    res.status(429).json({ error: 'RATE_LIMITED' });
  };
}
