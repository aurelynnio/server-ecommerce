require('dotenv').config();
const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');
const connectDB = require('../db/connect.db');
const { getRetryCount } = require('../utils/rabbitmq.utils');
const { createQueueMetrics } = require('../monitoring/queue.metrics');

const metrics = createQueueMetrics('notification_worker');

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
        metrics.processed.inc();
        channel.ack(data);
      } catch (error) {
        metrics.failed.inc();
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
          metrics.dlqFailed.inc();
          logger.error('Notification message exceeded retry limit', {
            queue: queue.dlq,
            failedQueue: queue.failedQueue,
            maxRetries: queue.maxRetries,
          });
          channel.ack(data);
          return;
        }

        await notificationService.publishNotificationRetry(data.content, nextRetryCount);
        metrics.dlqRetried.inc();
        channel.ack(data);
      } catch (error) {
        metrics.failed.inc();
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
  connectDB()
    .then(consumerNotificationQueue)
    .catch((error) => {
      logger.error('Failed to start notification worker', { error: error.message });
      process.exit(1);
    });
}

module.exports = consumerNotificationQueue;
