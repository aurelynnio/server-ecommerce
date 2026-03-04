const logger = require('../utils/logger');
const redisClient = require('../configs/redis.config');

class RedisService {
  constructor(redisClient) {
    this.redisClient = redisClient;
  }

  async set(key, value, ttl = 3600) {
    try {
      const stringValue = JSON.stringify(value);
      await this.redisClient.set(key, stringValue, 'EX', ttl);
    } catch (error) {
      logger.error(`Redis Set Error [${key}]:`, { error });
    }
  }

  async get(key) {
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis Get Error [${key}]:`, { error });
      return null;
    }
  }

  async del(key) {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      logger.error(`Redis Del Error [${key}]:`, { error });
    }
  }

  async delByPattern(pattern) {
    try {
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = newCursor;

        if (keys.length > 0) {
          await this.redisClient.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      if (deletedCount > 0) {
        logger.info(`Redis: Deleted ${deletedCount} keys matching pattern [${pattern}]`);
      }
    } catch (error) {
      logger.error(`Redis DelPattern Error [${pattern}]:`, { error });
    }
  }

  async deleteKey(key) {
    return this.del(key);
  }
}

module.exports = new RedisService(redisClient);
