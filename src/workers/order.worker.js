const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const Shop = require('../repositories/shop.repository');
const notificationService = require('../services/notification.service');
const orderService = require('../services/order.service');
const logger = require('../utils/logger');

const getRetryCount = (data) => {
  const retryCount = Number(data.properties?.headers?.['x-retry-count'] || 0);
  return Number.isNaN(retryCount) ? 0 : retryCount;
};

const ORDER_EVENT_TYPES = {
  CREATED: 'order.created',
  STATUS_CHANGED: 'order.status_changed',
};

const ORDER_STATUS_MESSAGES = {
  pending: 'Đơn hàng đang chờ xử lý.',
  confirmed: 'Đơn hàng đã được xác nhận.',
  processing: 'Đơn hàng đang được chuẩn bị.',
  shipped: 'Đơn hàng đang được giao.',
  delivered: 'Đơn hàng đã được giao thành công.',
  cancelled: 'Đơn hàng đã bị hủy.',
  returned: 'Đơn hàng đã được hoàn trả.',
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

  if (!payload.shopId) {
    return notifications;
  }

  const shop = await Shop.findByIdLean(payload.shopId);
  const sellerUserId = shop?.owner?.toString?.() || shop?.owner?.toString() || shop?.owner;

  if (sellerUserId && sellerUserId.toString() !== payload.userId?.toString()) {
    notifications.push({
      userId: sellerUserId,
      type: 'order_status',
      title: 'Bạn có đơn hàng mới',
      message: `Có đơn hàng mới từ ${payload.customerName || 'khách hàng'}.`,
      orderId: payload.orderId,
      shopId: payload.shopId,
      link: '/seller/orders',
    });
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

  if (payload.status === 'cancelled' && payload.actor === 'user' && payload.shopId) {
    const shop = await Shop.findByIdLean(payload.shopId);
    const sellerUserId = shop?.owner?.toString?.() || shop?.owner?.toString() || shop?.owner;

    if (sellerUserId && sellerUserId.toString() !== payload.userId?.toString()) {
      notifications.push({
        userId: sellerUserId,
        type: 'order_status',
        title: 'Đơn hàng đã bị hủy',
        message: `Khách hàng đã hủy đơn hàng ${getOrderCode(payload)}.`,
        orderId: payload.orderId,
        shopId: payload.shopId,
        link: '/seller/orders',
      });
    }
  }

  return notifications;
};

const handleOrderEvent = async (payload) => {
  switch (payload.eventName) {
    case ORDER_EVENT_TYPES.CREATED: {
      const notifications = await buildCreatedNotifications(payload);
      await publishNotifications(notifications);
      return true;
    }
    case ORDER_EVENT_TYPES.STATUS_CHANGED: {
      const notifications = await buildStatusChangedNotifications(payload);
      await publishNotifications(notifications);
      return true;
    }
    default:
      return false;
  }
};

const startOrderConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clientName: 'consumer',
  });

  await channel.consume(
    queue.name,
    async (data) => {
      if (!data) return;

      let eventName = 'unknown';
      try {
        const payload = JSON.parse(data.content.toString());
        eventName = payload.eventName || data.fields?.routingKey || 'unknown';
        payload.eventName = eventName;

        const handled = await handleOrderEvent(payload);
        if (!handled) {
          logger.warn('Unsupported order event received', { eventName });
          channel.ack(data);
          return;
        }

        logger.info('Order event processed', {
          eventName,
          orderId: payload.orderId,
        });
        channel.ack(data);
      } catch (error) {
        logger.error('Error occurred while processing order event', {
          eventName,
          error: error.message,
        });
        channel.nack(data, false, false);
      }
    },
    {
      noAck: false,
    },
  );

  logger.info('Order consumer started', { queue: queue.name });
};

const startOrderDLQConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clientName: 'dlq-consumer',
  });

  await channel.consume(
    queue.dlq,
    async (data) => {
      if (!data) return;
      try {
        const nextRetryCount = getRetryCount(data) + 1;

        if (nextRetryCount > queue.maxRetries) {
          await orderService.publishOrderFailed(data.content, queue.maxRetries);
          logger.error('Order message exceeded retry limit', {
            queue: queue.dlq,
            failedQueue: queue.failedQueue,
            maxRetries: queue.maxRetries,
          });
          channel.ack(data);
          return;
        }

        await orderService.publishOrderRetry(data.content, nextRetryCount);
        channel.ack(data);
      } catch (error) {
        logger.error('Error occurred while retrying order message', {
          error: error.message,
          currentRetryCount: getRetryCount(data),
        });
        channel.nack(data, false, true);
      }
    },
    {
      noAck: false,
    },
  );

  logger.info('Order DLQ consumer started', {
    queue: queue.dlq,
    retryQueue: queue.retryQueue,
    failedQueue: queue.failedQueue,
    retryDelayMs: queue.retryDelayMs,
  });
};

const consumerOrderQueue = async () => {
  await Promise.all([startOrderConsumer(), startOrderDLQConsumer()]);
};

if (require.main === module) {
  consumerOrderQueue().catch(logger.error);
}

module.exports = consumerOrderQueue;
