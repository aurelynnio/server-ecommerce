import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

const loadRateLimitMiddleware = () => {
  delete require.cache[require.resolve('../../src/middlewares/rateLimit.middleware')];
  return require('../../src/middlewares/rateLimit.middleware');
};

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('Rate Limit Middleware', () => {
  it('bypasses rate limiting when DISABLE_RATE_LIMIT is true', () => {
    process.env.DISABLE_RATE_LIMIT = 'true';
    const { createRedisRateLimiter } = loadRateLimitMiddleware();

    const limiter = createRedisRateLimiter({
      windowMs: 60 * 1000,
      limit: 5,
      message: 'Too many requests',
    });

    const req = { ip: '127.0.0.1' };
    const res = {};
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('instantiates rate limiter when DISABLE_RATE_LIMIT is false or unset', () => {
    process.env.DISABLE_RATE_LIMIT = 'false';
    const { createRedisRateLimiter } = loadRateLimitMiddleware();

    const limiter = createRedisRateLimiter({
      windowMs: 60 * 1000,
      limit: 10,
      message: 'Too many requests',
      keyPrefix: 'rl:test',
    });

    expect(typeof limiter).toBe('function');
  });

  it('exports all standard rate limiters with expected functions', () => {
    process.env.DISABLE_RATE_LIMIT = 'false';
    const {
      authRateLimiter,
      passwordResetRateLimiter,
      chatbotRateLimiter,
      newsletterRateLimiter,
    } = loadRateLimitMiddleware();

    expect(typeof authRateLimiter).toBe('function');
    expect(typeof passwordResetRateLimiter).toBe('function');
    expect(typeof chatbotRateLimiter).toBe('function');
    expect(typeof newsletterRateLimiter).toBe('function');
  });
});

