const outboxService = require('./outbox.service');
const rabbitMQConfig = require('../configs/rabbitMQ.config');
const { bumpVersion } = require('../chatbot/responseCache');
const logger = require('../utils/logger');

const EMBEDDING_EVENTS = {
  SYNC_PRODUCT: 'embedding.sync',
  DELETE_PRODUCT: 'embedding.delete',
  SYNC_CATEGORY: 'embedding.sync_category',
  SYNC_SHOP: 'embedding.sync_shop',
  RECONCILE: 'embedding.reconcile',
};

class EmbeddingSyncService {
  /**
   * Publish an embedding sync event directly to RabbitMQ (used by OutboxService dispatcher).
   * @param {Object} payload
   * @param {string} routingKey
   * @param {Object} [options]
   * @param {boolean} [options.strict=false]
   * @returns {Promise<boolean>}
   */
  async publishEmbeddingEvent(payload, routingKey, { strict = false } = {}) {
    try {
      const { channel } = await rabbitMQConfig.connectRabbitMQ('embedding', {
        confirm: strict,
        clientName: 'embedding-publisher',
      });
      const exchange = rabbitMQConfig.config_rabbitMQ.exchange.name;
      const buffer = Buffer.from(JSON.stringify(payload));
      await channel.publish(exchange, routingKey, buffer, {
        persistent: true,
        contentType: 'application/json',
      });
      return true;
    } catch (error) {
      logger.warn('[EmbeddingSync] Failed to publish embedding event', {
        routingKey,
        error: error.message,
      });
      if (strict) throw error;
      return false;
    }
  }

  /**
   * Enqueue a product embedding sync via Outbox and bump chatbot response cache version.
   * Never throws when called outside a transaction so business writes remain resilient.
   */
  async scheduleProductSync(
    productId,
    { reason = 'product_updated', session = null, strict = false } = {},
  ) {
    if (!productId) return false;
    const idStr = productId.toString();

    try {
      await outboxService.enqueueEvent(
        {
          eventType: EMBEDDING_EVENTS.SYNC_PRODUCT,
          routingKey: EMBEDDING_EVENTS.SYNC_PRODUCT,
          payload: {
            eventName: EMBEDDING_EVENTS.SYNC_PRODUCT,
            productId: idStr,
            reason,
            timestamp: new Date().toISOString(),
          },
        },
        { session },
      );
      if (!session) await bumpVersion();
      return true;
    } catch (error) {
      logger.warn('[EmbeddingSync] Failed to enqueue product sync', {
        productId: idStr,
        reason,
        error: error.message,
      });
      if (strict || session) throw error;
      return false;
    }
  }

  /**
   * Enqueue a product embedding deletion via Outbox and bump chatbot response cache version.
   */
  async scheduleProductDelete(
    productId,
    { reason = 'product_deleted', session = null, strict = false } = {},
  ) {
    if (!productId) return false;
    const idStr = productId.toString();

    try {
      await outboxService.enqueueEvent(
        {
          eventType: EMBEDDING_EVENTS.DELETE_PRODUCT,
          routingKey: EMBEDDING_EVENTS.DELETE_PRODUCT,
          payload: {
            eventName: EMBEDDING_EVENTS.DELETE_PRODUCT,
            productId: idStr,
            reason,
            timestamp: new Date().toISOString(),
          },
        },
        { session },
      );
      if (!session) await bumpVersion();
      return true;
    } catch (error) {
      logger.warn('[EmbeddingSync] Failed to enqueue product delete', {
        productId: idStr,
        reason,
        error: error.message,
      });
      if (strict || session) throw error;
      return false;
    }
  }

  /**
   * Enqueue multiple product syncs (e.g. after inventory deduction/restoration).
   */
  async scheduleProductsSync(
    productIds = [],
    { reason = 'inventory_changed', session = null, strict = false } = {},
  ) {
    const uniqueIds = [...new Set(productIds.filter(Boolean).map((id) => id.toString()))];
    if (uniqueIds.length === 0) return false;

    const events = uniqueIds.map((productId) => ({
      eventType: EMBEDDING_EVENTS.SYNC_PRODUCT,
      routingKey: EMBEDDING_EVENTS.SYNC_PRODUCT,
      payload: {
        eventName: EMBEDDING_EVENTS.SYNC_PRODUCT,
        productId,
        reason,
        timestamp: new Date().toISOString(),
      },
    }));

    try {
      await outboxService.enqueueEvents(events, { session });
      if (!session) await bumpVersion();
      return true;
    } catch (error) {
      logger.warn('[EmbeddingSync] Failed to enqueue batch product sync', {
        count: uniqueIds.length,
        reason,
        error: error.message,
      });
      if (strict || session) throw error;
      return false;
    }
  }

  /**
   * Enqueue category-wide embedding refresh (e.g. when category name changes).
   */
  async scheduleCategorySync(categoryId, { reason = 'category_updated', strict = false } = {}) {
    if (!categoryId) return false;
    const idStr = categoryId.toString();

    try {
      await outboxService.enqueueEvent({
        eventType: EMBEDDING_EVENTS.SYNC_CATEGORY,
        routingKey: EMBEDDING_EVENTS.SYNC_CATEGORY,
        payload: {
          eventName: EMBEDDING_EVENTS.SYNC_CATEGORY,
          categoryId: idStr,
          reason,
          timestamp: new Date().toISOString(),
        },
      });
      await bumpVersion();
      return true;
    } catch (error) {
      logger.warn('[EmbeddingSync] Failed to enqueue category sync', {
        categoryId: idStr,
        error: error.message,
      });
      if (strict) throw error;
      return false;
    }
  }

  /**
   * Enqueue shop-wide embedding sync or purge (e.g. when shop is banned/inactive/reactivated).
   */
  async scheduleShopSync(
    shopId,
    status,
    { reason = 'shop_status_changed', strict = false } = {},
  ) {
    if (!shopId) return false;
    const idStr = shopId.toString();

    try {
      await outboxService.enqueueEvent({
        eventType: EMBEDDING_EVENTS.SYNC_SHOP,
        routingKey: EMBEDDING_EVENTS.SYNC_SHOP,
        payload: {
          eventName: EMBEDDING_EVENTS.SYNC_SHOP,
          shopId: idStr,
          status,
          reason,
          timestamp: new Date().toISOString(),
        },
      });
      await bumpVersion();
      return true;
    } catch (error) {
      logger.warn('[EmbeddingSync] Failed to enqueue shop sync', {
        shopId: idStr,
        status,
        error: error.message,
      });
      if (strict) throw error;
      return false;
    }
  }

  async invalidateChatbotCache() {
    return bumpVersion();
  }
}

module.exports = new EmbeddingSyncService();
module.exports.EMBEDDING_EVENTS = EMBEDDING_EVENTS;
