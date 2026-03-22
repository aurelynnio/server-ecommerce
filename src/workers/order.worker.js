const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const logger = require('../utils/logger');

const getRetryCount = (data) => {
  const retryCount = Number(data.properties?.headers?.['x-retry-count'] || 0);
  return Number.isNaN(retryCount) ? 0 : retryCount;
};

const startWorkerConsumer = async ({
  clientName,
  prefetch,
  getQueueName,
  onMessage,
  startedLogMessage,
  getStartedLogMeta,
}) => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clientName,
  });
  const queueName = getQueueName(queue);

  await channel.consume(queueName, async (data) => onMessage(data, channel, queue), {
    noAck: false,
    prefetch,
  });
  logger.info(startedLogMessage, getStartedLogMeta(queue));
};

const startOrderConsumer = async () => {
  await startWorkerConsumer({
    clientName: 'consumer',
    prefetch: 10,
    getQueueName: (queue) => queue.name,
    onMessage: async (data, channel) => {},
    startedLogMessage: 'Order consumer started',
    getStartedLogMeta: (queue) => ({ queue: queue.name }),
  });
};

const startOrderDLQConsumer = async () => {
  await startWorkerConsumer({
    clientName: 'dlq-consumer',
    prefetch: 5,
    getQueueName: (queue) => queue.dlq,
    onMessage: async (data, channel, queue) => {
      if (!data) return;
      try {
        const nextRetryCount = getRetryCount(data) + 1;
        if (nextRetryCount > queue.maxReties) {
        }
      } catch (error) {}
    },
  });
};

const consumerOrderQueue = async () => {
  await Promise.all([startOrderConsumer(), startOrderDLQConsumer()]);
};

if (require.main === module) {
  consumerOrderQueue().catch(logger.error);
}
module.exports = consumerOrderQueue;
