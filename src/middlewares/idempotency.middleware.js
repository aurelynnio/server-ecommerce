const { StatusCodes } = require('http-status-codes');
const redisService = require('../services/redis.service');
const logger = require('../utils/logger');
const { getRequestUserId } = require('../utils/requestUser');

const IDEMPOTENCY_PROCESSING_TTL_SEC = 120; // 2 minutes lock
const IDEMPOTENCY_COMPLETED_TTL_SEC = 86400; // 24 hours result cache

/**
 * Idempotency middleware for high-value mutations (e.g. order checkout).
 * Prevents double order placement from rapid double clicks or network retries.
 */
const idempotencyMiddleware = (_options = {}) => {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      return next();
    }

    const userId = getRequestUserId(req.user) || 'anonymous';
    const redisKey = `idempotency:${userId}:${idempotencyKey}`;

    try {
      const cached = await redisService.get(redisKey);

      if (cached) {
        if (cached.status === 'processing') {
          return res.status(StatusCodes.CONFLICT).json({
            status: 'error',
            code: StatusCodes.CONFLICT,
            message: 'A request with this idempotency key is currently processing. Please wait.',
          });
        }

        if (cached.status === 'completed') {
          res.setHeader('X-Idempotent-Replayed', 'true');
          return res.status(cached.statusCode || StatusCodes.OK).json(cached.body);
        }
      }

      // Mark request as in-flight
      await redisService.set(
        redisKey,
        { status: 'processing', startedAt: new Date().toISOString() },
        IDEMPOTENCY_PROCESSING_TTL_SEC,
      );

      // Intercept response to store completed result or clear on failure
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        const statusCode = res.statusCode;

        if (statusCode >= 200 && statusCode < 300) {
          redisService
            .set(redisKey, { status: 'completed', statusCode, body }, IDEMPOTENCY_COMPLETED_TTL_SEC)
            .catch((err) => {
              logger.warn('Failed to cache idempotency response in Redis', {
                key: redisKey,
                error: err.message,
              });
            });
        } else {
          // If the request resulted in an error (e.g. 4xx, 5xx), release lock so user can retry
          redisService.del(redisKey).catch(() => {});
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error, bypassing check', {
        error: error.message,
      });
      next();
    }
  };
};

module.exports = idempotencyMiddleware;
