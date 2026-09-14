require('dotenv').config();
const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const Shop = require('../repositories/shop.repository');
const notificationService = require('../services/notification.service');
const orderService = require('../services/order.service');
const logger = require('../utils/logger');
const connectDB = require('../db/connect.db');
const { ORDER_EVENT_TYPES } = require('../shared/order/orderEvents');
const { getRetryCount } = require('../utils/rabbitmq.utils');
const { createQueueMetrics } = require('../monitoring/queue.metrics');

const ORDER_WORKER_PREFETCH = Number(process.env.ORDER_WORKER_PREFETCH) || 1;
const ORDER_DLQ_PREFETCH = Number(process.env.ORDER_DLQ_PREFETCH) || 1;
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

const getOrderCode = (payload) =>
  payload.orderCode || payload.orderId?.toString().slice(-6).toUpperCase() || 'N/A';

const publishNotifications = async (notifications) => {
  const filteredNotifications = notifications.filter((notification) => notification?.userId);
  if (filteredNotifications.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    filteredNotifications.map((notification) =>
      notificationService.publishNotification(notification, 'notification.created'),
    ),
  );

  const failedResult = results.find((result) => result.status === 'rejected');
  if (failedResult) {
    throw failedResult.reason;
  }
};

/** Trả về userId của chủ shop, hoặc null nếu không có shop/owner. */
const getSellerUserId = async (shopId) => {
  if (!shopId) return null;
  const shop = await Shop.findByIdLean(shopId);
  const owner = shop?.owner;
  return owner ? String(owner) : null;
};

const buildSellerNotification = ({ title, message, orderId, shopId, sellerUserId }) => ({
  userId: sellerUserId,
  type: 'order_status',
  title,
  message,
  orderId,
  shopId,
  link: '/seller/orders',
});

const buildCreatedNotifications = async (payload) => {
  const notifications = [
    {
      userId: payload.userId,
      type: 'order_status',
      title: 'Đơn hàng mới',
      message: `Đơn hàng ${getOrderCode(payload)} đã được tạo.`,
      orderId: payload.orderId,
      shopId: payload.shopId,
      link: '/user/purchase',
    },
  ];

  const sellerUserId = await getSellerUserId(payload.shopId);
  if (sellerUserId && sellerUserId !== payload.userId?.toString()) {
    notifications.push(
      buildSellerNotification({
        title: 'Bạn có đơn hàng mới',
        message: `Có đơn hàng mới từ ${payload.customerName || 'khách hàng'}.`,
        orderId: payload.orderId,
        shopId: payload.shopId,
        sellerUserId,
      }),
    );
  }

  return notifications;
};

const buildStatusChangedNotifications = async (payload) => {
  const notifications = [
    {
      userId: payload.userId,
      type: 'order_status',
      title: 'Cập nhật đơn hàng',
      message:
        payload.status === 'cancelled' && payload.actor === 'user'
          ? `Bạn đã hủy đơn hàng ${getOrderCode(payload)}.`
          : `Đơn hàng ${getOrderCode(payload)}: ${ORDER_STATUS_MESSAGES[payload.status] || 'Trạng thái đơn hàng đã thay đổi.'}`,
      orderId: payload.orderId,
      shopId: payload.shopId,
      link: '/user/purchase',
    },
  ];

  if (payload.status === 'cancelled' && payload.actor === 'user') {
    const sellerUserId = await getSellerUserId(payload.shopId);
    if (sellerUserId && sellerUserId !== payload.userId?.toString()) {
      notifications.push(
        buildSellerNotification({
          title: 'Đơn hàng đã bị hủy',
          message: `Khách hàng đã hủy đơn hàng ${getOrderCode(payload)}.`,
          orderId: payload.orderId,
          shopId: payload.shopId,
          sellerUserId,
        }),
      );
    }
  }

  return notifications;
};

const handleOrderEvent = async (payload) => {
  switch (payload.eventName) {
    case ORDER_EVENT_TYPES.CREATED: {
      const notifications = await buildCreatedNotifications(payload);
      await publishNotifications(notifications);
      return { success: true };
    }
    case ORDER_EVENT_TYPES.STATUS_CHANGED: {
      const notifications = await buildStatusChangedNotifications(payload);
      await publishNotifications(notifications);
      return { success: true };
    }
    default:
      return { success: false, unsupported: true };
  }
};

/** Áp prefetch 1 lần; addSetup tự áp dụng khi channel (đoàn kết) mới connect lại. */
const applyPrefetch = async (channel, count) => {
  await channel.addSetup((rawChannel) => rawChannel.prefetch(count));
};

/**
 * Đảm bảo mỗi message chỉ được settle (ack/nack) đúng 1 lần, kể cả timeout,
 * exception hoặc code path trả về sớm.
 */
const createSettler = (channel, message, name = 'message') => {
  let isSettled = false;

  const settle = (fn, action, ...args) => {
    if (isSettled) return;
    isSettled = true;
    try {
      fn(...args);
    } catch (err) {
      logger.error(`Failed to ${action} ${name}`, { error: err.message });
    }
  };

  return {
    isSettled: () => isSettled,
    ack: () => settle(channel.ack, 'ACK', message),
    nack: (requeue) => settle(channel.nack, 'NACK', message, false, requeue),
  };
};

/** Chạy task với timeout; khi quá hạn reject để consumer đưa message về DLQ/retry. */
const withProcessingTimeout = (task, timeoutMessage) => {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(timeoutMessage)),
      ORDER_PROCESSING_TIMEOUT_MS,
    );
  });

  const processing = task();
  return Promise.race([processing, timeoutPromise]).finally(() => clearTimeout(timeoutHandle));
};

/**
 * Tạo consumer tổng quát cho 1 queue (main hoặc DLQ) của 1 namespace.
 * Đảm bảo: watchdog timeout + settle đúng 1 lần + không bao giờ bỏ message ở Unacked.
 */
const consumeOrderQueue = async ({
  serviceKey,
  clientName,
  prefetch,
  queueName = 'name', // 'name' | 'dlq'
  messageName = 'order message',
  requeueOnFailure = false,
  handleMessage,
}) => {
  const { channel, queue } = await connectRabbitMQ(serviceKey, { clientName });
  await applyPrefetch(channel, prefetch);

  await channel.consume(
    queue[queueName] || queue.name,
    async (data) => {
      if (!data) return;

      const settler = createSettler(channel, data, messageName);
      let eventName = 'unknown';

      try {
        await withProcessingTimeout(async () => {
          await handleMessage({ data, queue, settler, setEventName: (name) => (eventName = name) });
        }, `${messageName} processing timed out after ${ORDER_PROCESSING_TIMEOUT_MS}ms`);
      } catch (error) {
        if (error.message.includes('timed out')) {
          metrics.timeout.inc();
          logger.warn(`Timeout while consuming ${messageName}`, { eventName });
        } else {
          metrics.failed.inc();
          logger.error(`Error occurred while consuming ${messageName}`, {
            eventName,
            error: error.message,
          });
        }
        settler.nack(requeueOnFailure);
      } finally {
        // Absolute guarantee: never leave a message in Unacked state!
        if (!settler.isSettled()) {
          settler.nack(requeueOnFailure);
        }
      }
    },
    { noAck: false },
  );

  logger.info(`${messageName} consumer started`, { queue: queue.name, prefetch });
  return { channel, queue };
};

/** Parse payload + gán eventName (fallback routingKey). */
const parseOrderPayload = (data, setEventName) => {
  const payload = JSON.parse(data.content.toString());
  const eventName = payload.eventName || data.fields?.routingKey || 'unknown';
  setEventName(eventName);
  payload.eventName = eventName;
  return payload;
};

/** Message chính: xử lý event rồi ACK thành công / NACK(false) thất bại. */
const handleMainOrderMessage = async ({ data, settler, setEventName }) => {
  const payload = parseOrderPayload(data, setEventName);
  const { eventName } = payload;

  const result = await handleOrderEvent(payload);
  if (result?.unsupported || !result) {
    metrics.unsupported.inc();
    logger.warn('Unsupported order event received', { eventName });
    settler.ack();
    return;
  }

  if (result.success) {
    // ONLY call ACK when MongoDB transaction committed successfully
    metrics.processed.inc();
    logger.info('Order event processed successfully', {
      eventName,
      orderId: payload.orderId,
      trackingId: payload.trackingId,
    });
    settler.ack();
    return;
  }

  // Order failed in worker: do NOT ACK! Dead-letter without requeue to DLQ
  metrics.failed.inc();
  const error = result.error || new Error('Order event execution failed');
  logger.error('Order event execution failed in worker, routing to DLQ', {
    eventName,
    trackingId: payload.trackingId,
    error: error.message,
    nonRetryable: result.nonRetryable,
  });
  settler.nack(false);
};

/**
 * Message DLQ của 1 namespace: quá retry → failedQueue; tracking 'completed'
 * → drop (idempotency); lỗi non-retryable → failedQueue; còn lại → retryQueue.
 */
const handleDlqMessage =
  (queueNamespace = 'order') =>
  async ({ data, queue, settler }) => {
    const nextRetryCount = getRetryCount(data) + 1;

    let payload = null;
    try {
      payload = JSON.parse(data.content.toString());
    } catch {}

    if (nextRetryCount > queue.maxRetries) {
      await orderService.publishOrderFailed(data.content, queue.maxRetries, queueNamespace);
      metrics.dlqFailed.inc();
      logger.error('Order message exceeded retry limit in DLQ, moved to failedQueue', {
        queue: queue.dlq,
        failedQueue: queue.failedQueue,
        maxRetries: queue.maxRetries,
        orderId: payload?.orderId,
      });
      settler.ack();
      return;
    }

    await orderService.publishOrderRetry(data.content, nextRetryCount, queueNamespace);
    metrics.dlqRetried.inc();
    settler.ack();
  };

/** EVENT order (created/status_changed): xử lý notification */
const startOrderEventConsumer = () =>
  consumeOrderQueue({
    serviceKey: 'order',
    clientName: 'event-consumer',
    prefetch: ORDER_WORKER_PREFETCH,
    messageName: 'order event',
    handleMessage: handleMainOrderMessage,
  });

const startOrderEventDLQConsumer = () =>
  consumeOrderQueue({
    serviceKey: 'order',
    clientName: 'event-dlq-consumer',
    prefetch: ORDER_DLQ_PREFETCH,
    queueName: 'dlq',
    messageName: 'order event DLQ message',
    requeueOnFailure: true,
    handleMessage: handleDlqMessage('order'),
  });

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
module.exports = consumerOrderQueue;
