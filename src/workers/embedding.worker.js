const rabbitMQConfig = require('../configs/rabbitMQ.config');
const Product = require('../repositories/product.repository');
const {
  embedProduct,
  deleteProductEmbedding,
  reconcileProductEmbeddings,
  isProductEmbeddingEligible,
} = require('../services/embedding.service');
const { EMBEDDING_EVENTS } = require('../services/embedding-sync.service');
const { bumpVersion } = require('../chatbot/responseCache');
const logger = require('../utils/logger');
const connectDB = require('../db/connect.db');
const {
  getRetryCount,
  publishToRetryQueue,
  publishToFailedQueue,
} = require('../utils/rabbitmq.utils');
const { createQueueMetrics } = require('../monitoring/queue.metrics');

const EMBEDDING_WORKER_PREFETCH = Number(process.env.EMBEDDING_WORKER_PREFETCH) || 10;
const metrics = createQueueMetrics('embedding_worker');

const syncProductState = async (productId) => {
  const product = await Product.findByIdWithCategoryNameLean(productId);
  if (!isProductEmbeddingEligible(product)) {
    await deleteProductEmbedding(productId);
    return { deleted: productId };
  }
  const ok = await embedProduct(product);
  if (!ok) throw new Error(`Failed to embed product ${productId}`);
  return { synced: productId };
};

/**
 * Process a single embedding sync event.
 * Idempotent: always reads the latest product/shop/category state from MongoDB.
 * @param {Object} payload
 */
const handleEmbeddingEvent = async (payload = {}) => {
  const { eventName, productId, categoryId, shopId } = payload;

  if (eventName === EMBEDDING_EVENTS.DELETE_PRODUCT) {
    if (!productId) return { skipped: true };
    const result = await syncProductState(productId);
    await bumpVersion().catch(() => {});
    return result;
  }

  if (eventName === EMBEDDING_EVENTS.SYNC_PRODUCT) {
    if (!productId) return { skipped: true };
    const result = await syncProductState(productId);
    await bumpVersion().catch(() => {});
    return result;
  }

  if (eventName === EMBEDDING_EVENTS.SYNC_CATEGORY) {
    if (!categoryId) return { skipped: true };
    const ProductModel = require('../models/product.model');
    const products = await ProductModel.find({
      category: categoryId,
      status: 'published',
    })
      .populate('category', 'name')
      .populate('shop', 'status')
      .lean();

    let synced = 0;
    for (const product of products) {
      if (isProductEmbeddingEligible(product)) {
        const ok = await embedProduct(product);
        if (ok) synced++;
      } else {
        await deleteProductEmbedding(product._id);
      }
    }
    await bumpVersion().catch(() => {});
    return { categoryId, synced, total: products.length };
  }

  if (eventName === EMBEDDING_EVENTS.SYNC_SHOP) {
    if (!shopId) return { skipped: true };
    const ProductModel = require('../models/product.model');
    const products = await ProductModel.find({ shop: shopId })
      .populate('category', 'name')
      .populate('shop', 'status')
      .lean();

    let synced = 0;
    let deleted = 0;
    for (const product of products) {
      if (isProductEmbeddingEligible(product)) {
        const ok = await embedProduct(product);
        if (ok) synced++;
      } else {
        await deleteProductEmbedding(product._id);
        deleted++;
      }
    }
    await bumpVersion().catch(() => {});
    return { shopId, synced, deleted };
  }

  if (eventName === EMBEDDING_EVENTS.RECONCILE) {
    const result = await reconcileProductEmbeddings();
    await bumpVersion().catch(() => {});
    return result;
  }

  logger.warn('[EmbeddingWorker] Unknown embedding event', { eventName });
  return { skipped: true };
};

const handleEmbeddingFailure = async ({ channel, msg, payload, error, config }) => {
  const retries = getRetryCount(msg);
  const nextRetryCount = retries + 1;
  const maxRetries = config?.maxRetries || 3;
  const content = msg.content;

  try {
    if (nextRetryCount >= maxRetries) {
      await publishToFailedQueue({
        serviceName: 'embedding',
        queueName: config.failedQueue,
        content,
        retryCount: nextRetryCount,
        clientName: 'embedding-failed-publisher',
      });
      logger.error('[EmbeddingWorker] Max retries reached, moved to failed queue', {
        eventName: payload?.eventName,
        productId: payload?.productId,
        retries: nextRetryCount,
        error: error.message,
      });
    } else {
      await publishToRetryQueue({
        serviceName: 'embedding',
        queueName: config.retryQueue,
        content,
        retryCount: nextRetryCount,
        clientName: 'embedding-retry-publisher',
      });
      logger.warn('[EmbeddingWorker] Error processing event, queued retry', {
        eventName: payload?.eventName,
        productId: payload?.productId,
        retries: nextRetryCount,
        error: error.message,
      });
    }
    channel.ack(msg);
  } catch (publishError) {
    logger.error('[EmbeddingWorker] Could not route failed message; requeueing original', {
      error: publishError.message,
      eventName: payload?.eventName,
    });
    channel.nack(msg, false, true);
  }
};

const consumerEmbeddingQueue = async () => {
  const { channel, queue } = await rabbitMQConfig.connectRabbitMQ('embedding', {
    clientName: 'embedding-worker',
  });
  const config = rabbitMQConfig.config_rabbitMQ.queues.embedding;
  const queueName = typeof queue === 'string' ? queue : queue.name;

  await channel.addSetup((rawChannel) => rawChannel.prefetch(EMBEDDING_WORKER_PREFETCH));
  logger.info('[EmbeddingWorker] Listening on queue', {
    queue: queueName,
    prefetch: EMBEDDING_WORKER_PREFETCH,
  });

  await channel.consume(
    queueName,
    async (msg) => {
      if (!msg) return;
      let payload;

      try {
        payload = JSON.parse(msg.content.toString());
      } catch (parseErr) {
        logger.error('[EmbeddingWorker] Invalid JSON message, discarding', {
          error: parseErr.message,
        });
        channel.nack(msg, false, false);
        return;
      }

      try {
        await handleEmbeddingEvent(payload);
        metrics.processed.inc();
        channel.ack(msg);
      } catch (err) {
        metrics.failed.inc();
        await handleEmbeddingFailure({ channel, msg, payload, error: err, config });
      }
    },
    { noAck: false },
  );
};

if (require.main === module) {
  require('dotenv').config();
  connectDB()
    .then(() => consumerEmbeddingQueue())
    .catch((err) => {
      logger.error('[EmbeddingWorker] Standalone startup failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = consumerEmbeddingQueue;
module.exports.handleEmbeddingEvent = handleEmbeddingEvent;
module.exports.handleEmbeddingFailure = handleEmbeddingFailure;
