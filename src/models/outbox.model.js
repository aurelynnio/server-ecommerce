const { Schema, model } = require('mongoose');

const outboxSchema = new Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true,
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
      index: true,
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
      index: true,
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

outboxSchema.index({ status: 1, nextRetryAt: 1, createdAt: 1 });

module.exports = model('Outbox', outboxSchema);
