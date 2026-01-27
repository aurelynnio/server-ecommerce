const redis = require("../configs/redis.config");
const logger = require("../utils/logger");

/**
 * Repository for Redis caching operations
 */
class CacheService {
  /**
   * Set cache with TTL
   * @param {string} key
   * @param {any} value
   * @param {number} ttl - Time to live in seconds (default 1 hour)
   */
  async set(key, value, ttl = 3600) {
    try {
      const stringValue = JSON.stringify(value);
      await redis.set(key, stringValue, "EX", ttl);
    } catch (error) {
      logger.error(`Redis Set Error [${key}]:`, { error });
    }
  }

  /**
   * Get cache
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis Get Error [${key}]:`, { error });
      return null;
    }
  }

  /**
   * Delete cache by key
   * @param {string} key
   */
  async del(key) {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`Redis Del Error [${key}]:`, { error });
    }
  }

  /**
   * Delete cache by pattern (e.g., "products:*")
   * PERFORMANCE FIX: Use SCAN instead of KEYS to avoid blocking Redis
   * @param {string} pattern
   */
  async delByPattern(pattern) {
    try {
      let cursor = '0';
      let deletedCount = 0;

      // Use SCAN to iterate through keys without blocking Redis
      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
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
}

module.exports = new CacheService();
