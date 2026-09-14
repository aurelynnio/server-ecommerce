const outboxRepository = require('../repositories/outbox.repository');
const logger = require('../utils/logger');

class OutboxService {
  constructor() {
    this._isDispatching = false;
  }

  /**
   * Enqueue a single domain event into the outbox.
   * Can be passed a Mongoose session to commit atomically with business operations.
   * @param {Object} event
   * @param {string} event.eventType - e.g. 'order.created'
   * @param {string} event.routingKey - e.g. 'order.created'
   * @param {Object} event.payload - Event data payload
   * @param {Object} [options]
   * @param {Object} [options.session] - Mongoose client session for transaction
   * @returns {Promise<Object>} Created outbox document
   */
  async enqueueEvent({ eventType, routingKey, payload }, { session = null } = {}) {
    return outboxRepository.createEvent(
      {
        eventType,
        routingKey,
        payload,
      },
      { session },
    );
  }

  /**
   * Enqueue multiple domain events atomically into the outbox.
   * @param {Array<Object>} events - Array of { eventType, routingKey, payload }
   * @param {Object} [options]
   * @param {Object} [options.session] - Mongoose client session
   * @returns {Promise<Array>} Inserted documents
   */
  async enqueueEvents(events, { session = null } = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    return outboxRepository.insertEvents(events, { session });
  }

  /**
   * Dispatch pending outbox events to RabbitMQ.
   * Ensures at-least-once delivery with exponential backoff on transient errors.
   * @param {number} [limit=50]
   * @returns {Promise<Object>} { processed, published, failed }
   */
  async dispatchPendingEvents(limit = 50) {
    if (this._isDispatching) {
      return { skipped: true };
    }

    this._isDispatching = true;
    let published = 0;
    let failed = 0;

    try {
      const pendingEvents = await outboxRepository.findPendingEvents(limit);
      if (!pendingEvents || pendingEvents.length === 0) {
        return { processed: 0, published: 0, failed: 0 };
      }

      // Lazy-load orderService to avoid circular require
      const orderService = require('./order.service');

      for (const event of pendingEvents) {
        try {
          // Publish with strict=true to ensure broker confirms receipt
          await orderService.publishOrder(event.payload, event.routingKey, { strict: true });
          await outboxRepository.markPublished(event._id);
          published++;
        } catch (pubErr) {
          const nextRetryCount = (event.retryCount || 0) + 1;
          const maxRetries = event.maxRetries || 5;
          const isDeadLetter = nextRetryCount >= maxRetries;
          const backoffMs = Math.min(300000, 1000 * Math.pow(2, nextRetryCount));
          const nextRetryAt = isDeadLetter ? null : new Date(Date.now() + backoffMs);

          await outboxRepository.markFailed(
            event._id,
            pubErr.message,
            nextRetryCount,
            nextRetryAt,
            isDeadLetter,
          );
          failed++;

          logger.warn('[OutboxService] Failed to dispatch outbox event, scheduled retry', {
            eventId: event._id?.toString(),
            eventType: event.eventType,
            retryCount: nextRetryCount,
            isDeadLetter,
            error: pubErr.message,
          });
        }
      }

      return {
        processed: pendingEvents.length,
        published,
        failed,
      };
    } catch (err) {
      logger.error('[OutboxService] Error in dispatchPendingEvents', {
        error: err.message,
      });
      return { processed: 0, published, failed, error: err.message };
    } finally {
      this._isDispatching = false;
    }
  }
}

module.exports = new OutboxService();
