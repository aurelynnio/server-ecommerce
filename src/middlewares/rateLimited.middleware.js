const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../configs/redis.config");
const { StatusCodes } = require("http-status-codes");
const { sendFail } = require("../shared/res/formatResponse");

/**
 * Create custom Rate Limiter
 * @param {Object} options - Configuration options
 */
const createLimiter = ({
  minutes = 15,
  max = 100,
  message = "Too many requests, please try again later.",
  prefix = "rl",
} = {}) => {
  return rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return sendFail(res, message, StatusCodes.TOO_MANY_REQUESTS);
    },
    // Sử dụng Redis Store
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: `rate-limit:${prefix}:`,
    }),
  });
};

// 1. Global limiter for all APIs (lenient)
const globalLimiter = createLimiter({
  minutes: 15,
  max: 1000,
  prefix: "global",
});

// 2. Strict limiter for Auth (Login/Register/Forgot Pass) - Prevent Spam/Brute Force
const authLimiter = createLimiter({
  minutes: 15,
  max: 10,
  message: "Too many login attempts. Please try again after 15 minutes.",
  prefix: "auth",
});

// 3. Limiter for other sensitive APIs (e.g., OTP, Payment)
const sensitiveLimiter = createLimiter({
  minutes: 1,
  max: 5,
  message: "Too many requests. Please slow down.",
  prefix: "sensitive",
});

module.exports = { globalLimiter, authLimiter, sensitiveLimiter };
