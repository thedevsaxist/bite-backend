import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';

const options = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
  },
} as const;

/** General limit applied to the whole API. */
export const apiRateLimiter = rateLimit({ ...options, limit: 300 });

/** Stricter limit for sign-in and sign-up, to slow down password guessing. */
export const authRateLimiter = rateLimit({ ...options, limit: 20 });

/**
 * Limit on meal analyses, which each cost an AI call. Counted per signed-in user rather than per
 * IP, so users behind the same network don't share a limit.
 */
export const analysisRateLimiter = rateLimit({
  ...options,
  limit: 30,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
});
