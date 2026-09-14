const Outbox = require('../models/outbox.model');
const BaseRepository = require('./base.repository');

class OutboxRepository extends BaseRepository {
  constructor() {
    super(Outbox);
  }

  /**
   * Create a single outbox event
   * @param {Object} event
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  createEvent({ eventType, routingKey, payload }, options = {}) {
    const doc = this.build({
      eventType,
      routingKey,
      payload,
      status: 'pending',
    });

    if (options.session) {
      return doc.save({ session: options.session });
    }
    return doc.save();
  }

  /**
   * Insert multiple outbox events
   * @param {Array<Object>} events
   * @param {Object} [options]
   * @returns {Promise<Array>}
   */
  insertEvents(events = [], options = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      return Promise.resolve([]);
    }

    const docs = events.map((e) => ({
      eventType: e.eventType,
      routingKey: e.routingKey,
      payload: e.payload,
      status: 'pending',
    }));

    return this.insertMany(docs, options);
  }

  /**
   * Find pending or failed outbox events eligible for processing
   * @param {number} [limit=50]
   * @returns {Promise<Array>}
   */
  findPendingEvents(limit = 50) {
    const now = new Date();
    return this.Model.find({
      status: { $in: ['pending', 'failed'] },
      $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
    })
      .sort({ createdAt: 1 })
      .limit(limit);
  }

  /**
   * Mark event as published
   * @param {string|Object} id
   * @returns {Promise<Object>}
   */
  markPublished(id) {
    return this.updateById(
      id,
      {
        $set: {
          status: 'published',
          processedAt: new Date(),
          lastError: null,
        },
      },
      { new: true },
    );
  }

  /**
   * Mark event as failed or dead_letter with backoff
   * @param {string|Object} id
   * @param {string} errorMessage
   * @param {number} retryCount
   * @param {Date|null} nextRetryAt
   * @param {boolean} [isDeadLetter=false]
   * @returns {Promise<Object>}
   */
  markFailed(id, errorMessage, retryCount, nextRetryAt, isDeadLetter = false) {
    return this.updateById(
      id,
      {
        $set: {
          status: isDeadLetter ? 'dead_letter' : 'failed',
          lastError: errorMessage,
          retryCount,
          nextRetryAt,
        },
      },
      { new: true },
    );
  }
}

module.exports = new OutboxRepository();
