const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../configs/redis.config');

const createRedisRateLimiter = ({ windowMs, limit, message, keyPrefix = 'rl' }) => {
  // Always use the Redis store. ioredis queues commands until the connection is
  // established, so the limiter stays Redis-backed (and cluster-scalable) instead
  // of silently falling back to a per-process MemoryStore at module-load time.
  const limiter = rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      status: 'fail',
      code: 429,
      message,
    },
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `${keyPrefix}:`,
    }),
  });

  return limiter;
};

const userKeyGenerator = (req) => {
  if (req.user?._id) return `user:${req.user._id}`;
  if (req.user?.userId) return `user:${req.user.userId}`;
  return `ip:${req.ip}`;
};

const authRateLimiter = createRedisRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many authentication attempts. Please try again later.',
});

const passwordResetRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many password reset requests. Please try again later.',
});

// Per-user (ưu tiên) hoặc per-IP, lưu trên Redis để scale nhiều instance.
const chatbotRateLimiter = createRedisRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: 'Bạn đang gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.',
  keyPrefix: 'rl:chatbot',
});

// Override keyGenerator cho chatbot để ưu tiên userId
chatbotRateLimiter.keyGenerator = (req) => {
  const key = userKeyGenerator(req);
  return key;
};

const newsletterRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many newsletter requests. Please try again later.',
});

module.exports = {
  authRateLimiter,
  passwordResetRateLimiter,
  chatbotRateLimiter,
  newsletterRateLimiter,
};
