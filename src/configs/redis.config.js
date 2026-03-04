const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
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
