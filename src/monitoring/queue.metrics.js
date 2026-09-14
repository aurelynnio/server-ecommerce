const { client, register } = require('./metrics.registry');

/**
 * Tạo bộ counters Prometheus cho 1 loại worker queue.
 * Trùng registry với API (metrics.registry.js) để scrape chung 1 `/metrics`.
 * @param {string} prefix - vd 'order_worker', 'notification_worker'
 */
const createQueueMetrics = (prefix) => ({
  processed: new client.Counter({
    name: `${prefix}_messages_processed_total`,
    help: 'Messages processed successfully and ACKed',
    registers: [register],
  }),
  failed: new client.Counter({
    name: `${prefix}_messages_failed_total`,
    help: 'Messages that failed and were routed to DLQ',
    registers: [register],
  }),
  timeout: new client.Counter({
    name: `${prefix}_messages_timeout_total`,
    help: 'Messages that hit the processing watchdog timeout',
    registers: [register],
  }),
  unsupported: new client.Counter({
    name: `${prefix}_messages_unsupported_total`,
    help: 'Messages with unsupported event type (ACKed)',
    registers: [register],
  }),
  duplicateSkipped: new client.Counter({
    name: `${prefix}_messages_duplicate_skipped_total`,
    help: 'Duplicate messages skipped by idempotency guard',
    registers: [register],
  }),
  dlqRetried: new client.Counter({
    name: `${prefix}_dlq_messages_retried_total`,
    help: 'DLQ messages sent back to retry queue',
    registers: [register],
  }),
  dlqFailed: new client.Counter({
    name: `${prefix}_dlq_messages_failed_total`,
    help: 'DLQ messages moved to failed queue',
    registers: [register],
  }),
  dlqDropped: new client.Counter({
    name: `${prefix}_dlq_messages_dropped_total`,
    help: 'DLQ messages dropped because order already completed',
    registers: [register],
  }),
});

module.exports = { createQueueMetrics };
