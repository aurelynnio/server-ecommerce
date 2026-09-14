const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  keepAlive: 10000,
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
};

const redis = new Redis(redisConfig);

let redisReady = false;

redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('error', (err) => {
  redisReady = false;
  if (process.env.NODE_ENV !== 'test') {
    logger.error('Redis client error:', err);
  }
});

redis.on('ready', () => {
  redisReady = true;
  logger.info('Redis client ready to use');
});

redis.on('end', () => {
  redisReady = false;
  logger.info('Redis client disconnected');
});

redis.isReady = () => redisReady;

module.exports = redis;
