const { Schema, model } = require('mongoose');

const outboxSchema = new Schema(
  {
    eventType: {
      type: String,
      required: true,
    },
    routingKey: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'published', 'failed', 'dead_letter'],
      default: 'pending',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 5,
    },
    lastError: {
      type: String,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'outbox_events',
  },
);

outboxSchema.index(
  { createdAt: 1, nextRetryAt: 1 },
  { partialFilterExpression: { status: { $in: ['pending', 'failed'] } } },
);
outboxSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 7 * 86400, partialFilterExpression: { status: 'published' } },
);

module.exports = model('Outbox', outboxSchema);
