require('dotenv').config();
const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const Shop = require('../repositories/shop.repository');
const notificationService = require('../services/notification.service');
const orderService = require('../services/order.service');
const redisService = require('../services/redis.service');
const logger = require('../utils/logger');
const connectDB = require('../db/connect.db');
const { ORDER_EVENT_TYPES } = require('../shared/order/orderEvents');
const { getRetryCount } = require('../utils/rabbitmq.utils');
const { createQueueMetrics } = require('../monitoring/queue.metrics');

/**
 * RabbitMQ prefetch sizing:
 * Setting PREFETCH = 1 creates a severe Stop-and-Wait bottleneck where the consumer
 * idles waiting for a network round-trip ACK before receiving the next message.
 * Under high throughput (e.g., 10,000 orders/s), network latency (e.g., 5ms) × 10,000 = 50s just for ACKs.
 *
 * Little's Law formula for optimal prefetch:
 *   prefetch = (target_throughput × average_processing_time_seconds) / number_of_workers
 *
 * For production order worker event handling, recommended prefetch is 50-100.
 */
const ORDER_WORKER_PREFETCH = Number(process.env.ORDER_WORKER_PREFETCH) || 50;
const ORDER_DLQ_PREFETCH = Number(process.env.ORDER_DLQ_PREFETCH) || 10;
const ORDER_PROCESSING_TIMEOUT_MS = Number(process.env.ORDER_PROCESSING_TIMEOUT_MS) || 30000;

const metrics = createQueueMetrics('order_worker');

const ORDER_STATUS_MESSAGES = {
  pending: 'Đơn hàng đang chờ xử lý.',
  confirmed: 'Đơn hàng đã được xác nhận.',
  processing: 'Đơn hàng đang được chuẩn bị.',
  shipped: 'Đơn hàng đang được giao.',
  delivered: 'Đơn hàng đã được giao thành công.',
  cancelled: 'Đơn hàng đã bị hủy.',
  returned: 'Đơn hàng đã được hoàn trả.',
};

const isNonRetryableError = (error) => {
  if (!error) return false;
  if (orderService.isRetryableTransactionError?.(error)) {
    return false;
  }
  const status = Number(error.statusCode || error.status);
  if (status >= 400 && status < 500 && status !== 429) {
    return true;
  }
  const msg = (error.message || '').toLowerCase();
  if (
    msg.includes('not found') ||
    msg.includes('out of stock') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota reached') ||
    msg.includes('invalid') ||
    msg.includes('unavailable') ||
    msg.includes('cast to') ||
    msg.includes('validation failed')
  ) {
    return true;
  }
  return false;
};

/**
 * Xử lý chính sự kiện order và phát notification trực tiếp.
 * Viết trực tiếp logic notification cho người mua và chủ shop mà không phân mảnh helper.
 */
const handleOrderEvent = async (payload) => {
  const { eventName, orderId, shopId, userId, customerName, status, actor } = payload;
  const orderCode =
    payload.orderCode || (orderId ? String(orderId).slice(-6).toUpperCase() : 'N/A');

  if (eventName === ORDER_EVENT_TYPES.COMMAND_CREATE) {
    const { trackingId, userId, orderData, isBuyNow } = payload;
    const trackingKey = `order:tracking:${trackingId}`;

    try {
      await redisService.set(
        trackingKey,
        {
          trackingId,
          userId,
          status: 'processing',
          updatedAt: new Date().toISOString(),
        },
        86400,
      );
    } catch (_redisErr) {}

    try {
      let orderResult;
      if (isBuyNow) {
        orderResult = await orderService.buyNow(userId, orderData);
      } else {
        orderResult = await orderService.createOrder(userId, orderData);
      }

      try {
        await redisService.set(
          trackingKey,
          {
            trackingId,
            userId,
            status: 'completed',
            orderGroupId: orderResult?.orderGroupId,
            orders: orderResult?.orders?.map((o) => ({
              orderId: o._id,
              orderCode: o.orderNumber || o._id?.toString()?.slice(-6).toUpperCase(),
            })),
            completedAt: new Date().toISOString(),
          },
          86400,
        );
      } catch (_redisErr) {}

      return { success: true };
    } catch (error) {
      if (payload.redisStockReserved && payload.reservedProductId) {
        try {
          await redisService.releaseFlashSaleStock(
            payload.reservedProductId,
            payload.reservedVariantId,
            payload.reservedQuantity || 1,
          );
        } catch (_compErr) {}
      }

      if (isNonRetryableError(error)) {
        try {
          await redisService.set(
            trackingKey,
            {
              trackingId,
              userId,
              status: 'failed',
              reason: error.message || 'Order execution failed',
              failedAt: new Date().toISOString(),
            },
            86400,
          );
        } catch (_redisErr) {}

        logger.warn('Order command execution rejected (non-retryable business error)', {
          trackingId,
          error: error.message,
        });

        return { success: true };
      }

      logger.error('Order command execution failed with retryable error, routing to DLQ', {
        trackingId,
        error: error.message,
      });
      throw error;
    }
  }

  const notifications = [];

  if (eventName === ORDER_EVENT_TYPES.CREATED) {
    // 1. Notification cho người mua
    notifications.push({
      userId,
      type: 'order_status',
      title: 'Đơn hàng mới',
      message: `Đơn hàng ${orderCode} đã được tạo.`,
      orderId,
      shopId,
      link: '/user/purchase',
    });

    // 2. Notification cho chủ shop (nếu có và không phải người mua)
    if (shopId) {
      const shop = await Shop.findByIdLean(shopId);
      const sellerUserId = shop?.owner ? String(shop.owner) : null;
      if (sellerUserId && sellerUserId !== String(userId)) {
        notifications.push({
          userId: sellerUserId,
          type: 'order_status',
          title: 'Bạn có đơn hàng mới',
          message: `Có đơn hàng mới từ ${customerName || 'khách hàng'}.`,
          orderId,
          shopId,
          link: '/seller/orders',
        });
      }
    }
  } else if (eventName === ORDER_EVENT_TYPES.STATUS_CHANGED) {
    const isCancelledByUser = status === 'cancelled' && actor === 'user';
    const statusMsg = ORDER_STATUS_MESSAGES[status] || 'Trạng thái đơn hàng đã thay đổi.';

    // 1. Notification cho người mua
    notifications.push({
      userId,
      type: 'order_status',
      title: 'Cập nhật đơn hàng',
      message: isCancelledByUser
        ? `Bạn đã hủy đơn hàng ${orderCode}.`
        : `Đơn hàng ${orderCode}: ${statusMsg}`,
      orderId,
      shopId,
      link: '/user/purchase',
    });

    // 2. Notification cho chủ shop khi user hủy
    if (isCancelledByUser && shopId) {
      const shop = await Shop.findByIdLean(shopId);
      const sellerUserId = shop?.owner ? String(shop.owner) : null;
      if (sellerUserId && sellerUserId !== String(userId)) {
        notifications.push({
          userId: sellerUserId,
          type: 'order_status',
          title: 'Đơn hàng đã bị hủy',
          message: `Khách hàng đã hủy đơn hàng ${orderCode}.`,
          orderId,
          shopId,
          link: '/seller/orders',
        });
      }
    }
  } else {
    return { success: false, unsupported: true };
  }

  // Publish tất cả notifications hợp lệ
  const validNotifications = notifications.filter((item) => item?.userId);
  if (validNotifications.length > 0) {
    const publishResults = await Promise.allSettled(
      validNotifications.map((notification) =>
        notificationService.publishNotification(notification, 'notification.created'),
      ),
    );

    const failedResult = publishResults.find((result) => result.status === 'rejected');
    if (failedResult) {
      throw failedResult.reason;
    }
  }

  return { success: true };
};

/**
 * Consumer cho hàng đợi sự kiện order chính.
 * Viết trực tiếp kết nối, prefetch, timeout safeguard, parse payload, logging và metrics.
 */
const startOrderEventConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clientName: 'event-consumer',
  });
  await channel.addSetup((rawChannel) => rawChannel.prefetch(ORDER_WORKER_PREFETCH));

  await channel.consume(
    queue.name,
    async (data) => {
      if (!data) return;

      let isSettled = false;
      const settle = (action) => {
        if (isSettled) return;
        isSettled = true;
        try {
          action();
        } catch (err) {
          logger.error('Failed to settle order message', { error: err.message });
        }
      };

      let timeoutHandle;
      let eventName = 'unknown';

      try {
        let payload;
        try {
          payload = JSON.parse(data.content.toString());
        } catch (parseError) {
          logger.error('Failed to parse order message JSON', { error: parseError.message });
          settle(() => channel.nack(data, false, false));
          return;
        }

        eventName = payload.eventName || data.fields?.routingKey || 'unknown';
        payload.eventName = eventName;

        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(
                  `Order event processing timed out after ${ORDER_PROCESSING_TIMEOUT_MS}ms`,
                ),
              ),
            ORDER_PROCESSING_TIMEOUT_MS,
          );
        });

        const result = await Promise.race([handleOrderEvent(payload), timeoutPromise]);

        if (result?.unsupported || !result) {
          metrics.unsupported.inc();
          logger.warn('Unsupported order event received', { eventName });
          settle(() => channel.ack(data));
        } else if (result.success) {
          metrics.processed.inc();
          logger.info('Order event processed successfully', {
            eventName,
            orderId: payload.orderId,
            trackingId: payload.trackingId,
          });
          settle(() => channel.ack(data));
        } else {
          metrics.failed.inc();
          logger.error('Order event execution failed in worker, routing to DLQ', {
            eventName,
            trackingId: payload.trackingId,
          });
          settle(() => channel.nack(data, false, false));
        }
      } catch (error) {
        if (error.message.includes('timed out')) {
          metrics.timeout.inc();
          logger.warn('Timeout while consuming order message', { eventName, error: error.message });
        } else {
          metrics.failed.inc();
          logger.error('Error occurred while consuming order message', {
            eventName,
            error: error.message,
          });
        }
        settle(() => channel.nack(data, false, false));
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (!isSettled) {
          settle(() => channel.nack(data, false, false));
        }
      }
    },
    { noAck: false },
  );

  logger.info('Order event consumer started', {
    queue: queue.name,
    prefetch: ORDER_WORKER_PREFETCH,
  });
};

/**
 * Consumer cho hàng đợi DLQ order.
 * Viết trực tiếp logic retry và failedQueue mà không dùng abstraction thừa.
 */
const startOrderEventDLQConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clientName: 'event-dlq-consumer',
  });
  await channel.addSetup((rawChannel) => rawChannel.prefetch(ORDER_DLQ_PREFETCH));

  await channel.consume(
    queue.dlq,
    async (data) => {
      if (!data) return;

      try {
        const nextRetryCount = getRetryCount(data) + 1;
        let payload = null;
        try {
          payload = JSON.parse(data.content.toString());
        } catch {}

        if (nextRetryCount > queue.maxRetries) {
          await orderService.publishOrderFailed(data.content, queue.maxRetries, 'order');
          metrics.dlqFailed.inc();
          logger.error('Order message exceeded retry limit in DLQ, moved to failedQueue', {
            queue: queue.dlq,
            failedQueue: queue.failedQueue,
            maxRetries: queue.maxRetries,
            orderId: payload?.orderId,
          });
          channel.ack(data);
          return;
        }

        await orderService.publishOrderRetry(data.content, nextRetryCount, 'order');
        metrics.dlqRetried.inc();
        channel.ack(data);
      } catch (error) {
        metrics.failed.inc();
        logger.error('Error occurred while retrying order DLQ message', {
          error: error.message,
          currentRetryCount: getRetryCount(data),
        });
        channel.nack(data, false, true);
      }
    },
    { noAck: false },
  );

  logger.info('Order event DLQ consumer started', {
    queue: queue.dlq,
    retryQueue: queue.retryQueue,
    failedQueue: queue.failedQueue,
    retryDelayMs: queue.retryDelayMs,
    prefetch: ORDER_DLQ_PREFETCH,
  });
};

const consumerOrderQueue = async () => {
  await Promise.all([startOrderEventConsumer(), startOrderEventDLQConsumer()]);
};

if (require.main === module) {
  connectDB()
    .then(() => consumerOrderQueue())
    .catch((error) => {
      logger.error('Failed to start order worker', { error: error.message });
      process.exit(1);
    });
}

// Exports dùng trong test
consumerOrderQueue._handleOrderEvent = handleOrderEvent;
consumerOrderQueue._isNonRetryableError = isNonRetryableError;
consumerOrderQueue.ORDER_WORKER_PREFETCH = ORDER_WORKER_PREFETCH;
consumerOrderQueue.ORDER_DLQ_PREFETCH = ORDER_DLQ_PREFETCH;
consumerOrderQueue.calculateOptimalPrefetch = (
  targetThroughput,
  avgProcessingTimeSeconds,
  numberOfWorkers = 1,
) => Math.max(1, Math.round((targetThroughput * avgProcessingTimeSeconds) / numberOfWorkers));
module.exports = consumerOrderQueue;
