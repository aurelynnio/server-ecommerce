const { rateLimit } = require("express-rate-limit");
const { StatusCodes } = require("http-status-codes");
const { sendFail } = require("../shared/res/formatResponse");

/**
 * Create custom Rate Limiter
 * @param {Object} options - Configuration options
 * @param {number} options.minutes - Time window in minutes
 * @param {number} options.max - Maximum number of requests
 * @param {string} options.message - Error message
 * @returns {Function} Express middleware
 */
const createLimiter = ({
  minutes = 15,
  max = 100,
  message = "Too many requests, please try again later.",
} = {}) => {
  return rateLimit({
    windowMs: minutes * 60 * 1000, // Convert to milliseconds
    limit: max,
    standardHeaders: true, // Return `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Custom response handler to match project format
    handler: (req, res) => {
      return sendFail(res, message, StatusCodes.TOO_MANY_REQUESTS);
    },
    // TODO: When deploying to Production with Redis, add store configuration here:
    // store: new RedisStore({ ... }),
  });
};

// 1. Global limiter for all APIs (lenient)
const globalLimiter = createLimiter({
  minutes: 15,
  max: 1000, // Allow 1000 requests per 15 minutes
});

// 2. Strict limiter for Auth (Login/Register/Forgot Pass) - Prevent Spam/Brute Force
const authLimiter = createLimiter({
  minutes: 15,
  max: 10, // Only allow 10 attempts per 15 minutes
  message: "Too many login attempts. Please try again after 15 minutes.",
});

// 3. Limiter for other sensitive APIs (e.g., OTP, Payment)
const sensitiveLimiter = createLimiter({
  minutes: 1,
  max: 5,
  message: "Too many requests. Please slow down.",
});

module.exports = { globalLimiter, authLimiter, sensitiveLimiter };
