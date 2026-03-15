const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

const RECONNECT_DELAY_MS = Number(process.env.RABBITMQ_RECONNECT_DELAY_MS) || 5000;

const reconnectTimers = new Map();

const scheduleReconnect = (workerName, startConsumer, reason, error) => {
  if (reconnectTimers.has(workerName)) return;

  if (error) {
    logger.error('Notification worker disconnected with error', {
      worker: workerName,
      reason,
      error: error.message,
    });
  } else {
    logger.warn('Notification worker disconnected', {
      worker: workerName,
      reason,
    });
  }

  const timer = setTimeout(() => {
    reconnectTimers.delete(workerName);
    runConsumer(workerName, startConsumer, true).catch((reconnectError) => {
      logger.error('Notification worker reconnect failed', {
        worker: workerName,
        error: reconnectError.message,
      });
    });
  }, RECONNECT_DELAY_MS);

  timer.unref?.();
  reconnectTimers.set(workerName, timer);
};

const bindReconnectHandlers = (workerName, startConsumer, connection, channel) => {
  connection.once('error', (error) =>
    scheduleReconnect(workerName, startConsumer, 'connection_error', error),
  );
  connection.once('close', () => scheduleReconnect(workerName, startConsumer, 'connection_close'));
  channel.once('error', (error) =>
    scheduleReconnect(workerName, startConsumer, 'channel_error', error),
  );
  channel.once('close', () => scheduleReconnect(workerName, startConsumer, 'channel_close'));
};

const getRetryCount = (data) => {
  const retryCount = Number(data.properties?.headers?.['x-retry-count'] || 0);
  return Number.isNaN(retryCount) ? 0 : retryCount;
};

const startNotificationConsumer = async () => {
  const { connection, channel, queue } = await connectRabbitMQ('notification', {
    clientName: 'consumer',
  });
  bindReconnectHandlers('notification-consumer', startNotificationConsumer, connection, channel);

  await channel.prefetch(10);
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
    },
  );

  logger.info('Notification consumer started', { queue: queue.name });
};

const startNotificationDLQConsumer = async () => {
  const { connection, channel, queue } = await connectRabbitMQ('notification', {
    clientName: 'dlq-consumer',
  });
  bindReconnectHandlers(
    'notification-dlq-consumer',
    startNotificationDLQConsumer,
    connection,
    channel,
  );

  await channel.prefetch(5);
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
    },
  );

  logger.info('Notification DLQ consumer started', {
    queue: queue.dlq,
    retryQueue: queue.retryQueue,
    failedQueue: queue.failedQueue,
    retryDelayMs: queue.retryDelayMs,
  });
};

const runConsumer = async (workerName, startConsumer, allowReconnect = false) => {
  try {
    await startConsumer();
  } catch (error) {
    logger.error('Error occurred while consuming notification queue', {
      worker: workerName,
      error: error.message,
    });

    if (!allowReconnect) {
      throw error;
    }

    scheduleReconnect(workerName, startConsumer, 'startup_error', error);
  }
};

const consumerNotificationQueue = async () => {
  await Promise.all([
    runConsumer('notification-consumer', startNotificationConsumer),
    runConsumer('notification-dlq-consumer', startNotificationDLQConsumer),
  ]);
};

if (require.main === module) {
  consumerNotificationQueue().catch(logger.error);
}

module.exports = consumerNotificationQueue;
