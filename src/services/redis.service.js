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

  async increment(key, ttl = 3600) {
    try {
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, ttl);
      }
      return count;
    } catch (error) {
      logger.error(`Redis Increment Error [${key}]:`, { error });
      return null;
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

  /**
   * Initialize Flash Sale stock in Redis (Fail-Fast Ingestion Shield)
   * @param {string} productId
   * @param {string|null} variantId
   * @param {number} stock
   * @param {number} ttl
   */
  async initFlashSaleStock(productId, variantId, stock, ttl = 86400) {
    try {
      const stockKey = `stock:flashsale:${productId}${variantId ? `:${variantId}` : ''}`;
      await this.redisClient.set(stockKey, String(stock), 'EX', ttl);
      logger.info(`Redis: Initialized flash sale stock [${stockKey}] = ${stock}`);
    } catch (error) {
      logger.error('Redis initFlashSaleStock Error:', { error: error.message, productId });
    }
  }

  /**
   * Atomically reserve Flash Sale stock using Lua script (Fail-Fast Shield)
   * Returns:
   *   >= 0 : Succeeded, remaining stock in Redis
   *   -1   : Out of stock (Fail-Fast trigger)
   *   1    : Key does not exist (Bypass shield for non-flash-sale items)
   * @param {string} productId
   * @param {string|null} variantId
   * @param {number} quantity
   * @returns {Promise<number>}
   */
  async reserveFlashSaleStock(productId, variantId = null, quantity = 1) {
    const LUA_RESERVE = `
      local stock = redis.call('get', KEYS[1])
      if not stock then
        return 1
      end
      local current = tonumber(stock)
      local qty = tonumber(ARGV[1])
      if current < qty then
        return -1
      end
      return redis.call('decrby', KEYS[1], qty)
    `;

    try {
      const stockKey = `stock:flashsale:${productId}${variantId ? `:${variantId}` : ''}`;
      const result = await this.redisClient.eval(LUA_RESERVE, 1, stockKey, quantity);
      return Number(result);
    } catch (error) {
      logger.error('Redis reserveFlashSaleStock Error:', { error: error.message, productId });
      return 1; // Fallback to DB on unexpected Redis failure
    }
  }

  /**
   * Release / rollback reserved Flash Sale stock back to Redis (Compensation on worker error)
   * @param {string} productId
   * @param {string|null} variantId
   * @param {number} quantity
   */
  async releaseFlashSaleStock(productId, variantId = null, quantity = 1) {
    try {
      const stockKey = `stock:flashsale:${productId}${variantId ? `:${variantId}` : ''}`;
      const exists = await this.redisClient.exists(stockKey);
      if (exists) {
        await this.redisClient.incrby(stockKey, quantity);
        logger.info(`Redis: Released flash sale stock [${stockKey}] +${quantity}`);
      }
    } catch (error) {
      logger.error('Redis releaseFlashSaleStock Error:', { error: error.message, productId });
    }
  }
}

module.exports = new RedisService(redisClient);
