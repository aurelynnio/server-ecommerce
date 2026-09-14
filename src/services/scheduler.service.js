const logger = require('../utils/logger');
const orderService = require('./order.service');

class SchedulerService {
  constructor() {
    this._orderExpiryTimer = null;
    this._outboxDispatchTimer = null;
    this._isCleaningUpOrders = false;
    this._isDispatchingOutbox = false;
    this._isRunning = false;
  }

  /**
   * Run one iteration of expired unpaid orders cancellation.
   * Prevents overlapping executions.
   * @param {number} [timeoutMinutes=15]
   * @returns {Promise<number>} Number of orders cancelled
   */
  async runExpiredOrderCleanup(timeoutMinutes = 15) {
    if (this._isCleaningUpOrders) {
      logger.warn('[Scheduler] Expired order cleanup is already in progress, skipping iteration');
      return 0;
    }

    this._isCleaningUpOrders = true;
    try {
      const cancelledCount = await orderService.cancelExpiredUnpaidOrders(timeoutMinutes);
      if (cancelledCount > 0) {
        logger.info('[Scheduler] Auto-cancelled expired unpaid online orders', {
          cancelledCount,
          timeoutMinutes,
        });
      }
      return cancelledCount;
    } catch (error) {
      logger.error('[Scheduler] Error during expired order cleanup', {
        error: error.message,
        stack: error.stack,
      });
      return 0;
    } finally {
      this._isCleaningUpOrders = false;
    }
  }

  /**
   * Run one iteration of pending outbox events dispatching.
   * Prevents overlapping executions.
   * @returns {Promise<Object>} Dispatch summary
   */
  async runOutboxDispatch() {
    if (this._isDispatchingOutbox) {
      return { skipped: true };
    }

    this._isDispatchingOutbox = true;
    try {
      // Lazy-load to prevent circular dependencies
      const outboxService = require('./outbox.service');
      const result = await outboxService.dispatchPendingEvents();
      return result;
    } catch (error) {
      logger.error('[Scheduler] Error during outbox dispatch', {
        error: error.message,
        stack: error.stack,
      });
      return { error: error.message };
    } finally {
      this._isDispatchingOutbox = false;
    }
  }

  /**
   * Start background scheduler jobs.
   * @param {Object} [options]
   * @param {number} [options.orderExpiryIntervalMs] - Interval for order cleanup (default: 5 mins)
   * @param {number} [options.outboxDispatchIntervalMs] - Interval for outbox dispatch (default: 10s)
   * @param {number} [options.orderTimeoutMinutes] - Expiry threshold for unpaid orders (default: 15 mins)
   */
  startScheduler(options = {}) {
    if (this._isRunning) {
      logger.warn('[Scheduler] Scheduler is already running');
      return;
    }

    const orderExpiryIntervalMs =
      options.orderExpiryIntervalMs ||
      Number(process.env.UNPAID_ORDER_CHECK_INTERVAL_MS) ||
      5 * 60 * 1000;

    const outboxDispatchIntervalMs =
      options.outboxDispatchIntervalMs ||
      Number(process.env.OUTBOX_DISPATCH_INTERVAL_MS) ||
      10 * 1000;

    const orderTimeoutMinutes =
      options.orderTimeoutMinutes || Number(process.env.UNPAID_ORDER_TIMEOUT_MINUTES) || 15;

    this._isRunning = true;
    logger.info('[Scheduler] Starting background scheduler', {
      orderExpiryIntervalMs,
      outboxDispatchIntervalMs,
      orderTimeoutMinutes,
    });

    // Schedule order cleanup
    this._orderExpiryTimer = setInterval(() => {
      this.runExpiredOrderCleanup(orderTimeoutMinutes).catch((err) => {
        logger.error('[Scheduler] Unexpected error in order expiry interval', {
          error: err.message,
        });
      });
    }, orderExpiryIntervalMs);
    this._orderExpiryTimer.unref();

    // Schedule outbox dispatcher
    this._outboxDispatchTimer = setInterval(() => {
      this.runOutboxDispatch().catch((err) => {
        logger.error('[Scheduler] Unexpected error in outbox dispatch interval', {
          error: err.message,
        });
      });
    }, outboxDispatchIntervalMs);
    this._outboxDispatchTimer.unref();
  }

  /**
   * Stop all background scheduler jobs gracefully.
   */
  stopScheduler() {
    if (!this._isRunning) {
      return;
    }

    if (this._orderExpiryTimer) {
      clearInterval(this._orderExpiryTimer);
      this._orderExpiryTimer = null;
    }

    if (this._outboxDispatchTimer) {
      clearInterval(this._outboxDispatchTimer);
      this._outboxDispatchTimer = null;
    }

    this._isRunning = false;
    logger.info('[Scheduler] Stopped all background scheduler jobs');
  }

  /**
   * Check whether scheduler is active
   * @returns {boolean}
   */
  isSchedulerRunning() {
    return this._isRunning;
  }
}

module.exports = new SchedulerService();
