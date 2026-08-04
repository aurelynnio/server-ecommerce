const rateLimit = require('express-rate-limit');

const createRateLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      status: 'fail',
      code: 429,
      message,
    },
  });

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many authentication attempts. Please try again later.',
});

const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many password reset requests. Please try again later.',
});

const chatbotRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: 'Too many chatbot requests. Please try again later.',
});

const newsletterRateLimiter = createRateLimiter({
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
