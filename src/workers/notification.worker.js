const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

const getRetryCount = (data) => {
  const retryCount = Number(data.properties?.headers?.['x-retry-count'] || 0);
  return Number.isNaN(retryCount) ? 0 : retryCount;
};

const startNotificationConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('notification', {
    clientName: 'consumer',
  });

  await channel.consume(
    queue.name,
    async (data) => {
      if (!data) return;

      try {
        const payload = JSON.parse(data.content.toString());
        await notificationService.createNotification(payload);
        channel.ack(data);
      } catch (error) {
        logger.error('Error occurred while processing notification', { error: error.message });
        channel.nack(data, false, false);
      }
    },
    {
      noAck: false,
      prefetch: 10,
    },
  );

  logger.info('Notification consumer started', { queue: queue.name });
};

const startNotificationDLQConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('notification', {
    clientName: 'dlq-consumer',
  });

  await channel.consume(
    queue.dlq,
    async (data) => {
      if (!data) return;

      try {
        const nextRetryCount = getRetryCount(data) + 1;

        if (nextRetryCount > queue.maxRetries) {
          await notificationService.publishNotificationFailed(data.content, queue.maxRetries);
          logger.error('Notification message exceeded retry limit', {
            queue: queue.dlq,
            failedQueue: queue.failedQueue,
            maxRetries: queue.maxRetries,
          });
          channel.ack(data);
          return;
        }

        await notificationService.publishNotificationRetry(data.content, nextRetryCount);
        channel.ack(data);
      } catch (error) {
        logger.error('Error occurred while retrying notification message', {
          error: error.message,
          currentRetryCount: getRetryCount(data),
        });
        channel.nack(data, false, true);
      }
    },
    {
      noAck: false,
      prefetch: 5,
    },
  );

  logger.info('Notification DLQ consumer started', {
    queue: queue.dlq,
    retryQueue: queue.retryQueue,
    failedQueue: queue.failedQueue,
    retryDelayMs: queue.retryDelayMs,
  });
};

const consumerNotificationQueue = async () => {
  await Promise.all([startNotificationConsumer(), startNotificationDLQConsumer()]);
};

if (require.main === module) {
  consumerNotificationQueue().catch(logger.error);
}

module.exports = consumerNotificationQueue;
