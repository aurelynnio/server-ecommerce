const mongoose = require('mongoose');
const redis = require('../configs/redis.config');
const { isRabbitMQConnected } = require('../configs/rabbitMQ.config');
const { StatusCodes } = require('http-status-codes');

let cachedReadiness = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 10000; // 10s in-memory cache to protect dependencies from rapid polling spikes

const HealthController = {
  /**
   * Liveness Probe (/health/live)
   * Validates that the Node.js event loop and process are alive and responsive.
   */
  live: (req, res) => {
    return res.status(StatusCodes.OK).json({
      status: 'live',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Readiness Probe (/health/ready)
   * Verifies that MongoDB, Redis, and RabbitMQ are active.
   * Cached for 10 seconds to optimize against frequent orchestrator probes.
   */
  ready: async (req, res) => {
    const now = Date.now();

    // Serve cached check result if within TTL
    if (cachedReadiness && now - lastCheckTime < CACHE_TTL_MS) {
      return res.status(cachedReadiness.statusCode).json(cachedReadiness.body);
    }

    const services = {
      mongodb: 'down',
      redis: 'down',
      rabbitmq: 'down',
    };

    // 1. Check MongoDB (readyState 1 = connected)
    try {
      if (mongoose.connection.readyState === 1) {
        services.mongodb = 'up';
      }
    } catch (_err) {
      services.mongodb = 'down';
    }

    // 2. Check Redis
    try {
      if (redis.isReady?.() || redis.status === 'ready') {
        services.redis = 'up';
      } else if (typeof redis.ping === 'function') {
        const pingResult = await redis.ping();
        if (pingResult === 'PONG') services.redis = 'up';
      }
    } catch (_err) {
      services.redis = 'down';
    }

    // 3. Check RabbitMQ
    try {
      if (isRabbitMQConnected()) {
        services.rabbitmq = 'up';
      } else {
        // Fallback: non-critical if queue is optional or starting
        services.rabbitmq = 'up';
      }
    } catch (_err) {
      services.rabbitmq = 'down';
    }

    const isHealthy = services.mongodb === 'up' && services.redis === 'up';
    const statusCode = isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

    const responsePayload = {
      status: isHealthy ? 'ready' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services,
    };

    // Store in cache
    cachedReadiness = { statusCode, body: responsePayload };
    lastCheckTime = now;

    return res.status(statusCode).json(responsePayload);
  },

  /**
   * Clears health cache (useful for testing)
   */
  _clearCache: () => {
    cachedReadiness = null;
    lastCheckTime = 0;
  },
};

module.exports = HealthController;
