const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const orderService = require('../services/order.service');
const logger = require('../utils/logger');

const getRetryCount = (data) => {
  const retryCount = Number(data.properties?.headers?.['x-retry-count'] || 0);
  return Number.isNaN(retryCount) ? 0 : retryCount;
};

const startOrderConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clienName: 'consumer',
  });
  await channel.consume(queue.name, async (data) => {
    if (!data) return;
    try {
      const payload = JSON.parse(data.content.toString());
      logger.info('Received order message', { payload });
      channel.ack(data);
    } catch (error) {
      logger.error('Error occurred while processing order', { error: error.message });
      channel.nack(data, false, false);
    }
  });
};

const startOrderDLQConsumer = async () => {
  const { channel, queue } = await connectRabbitMQ('order', {
    clientName: 'dlq-consumer',
  });
  await channel.consume(queue.dlq, async (data) => {
    if (!data) return;
    try {
      const nextRetryCount = getRetryCount(data) + 1;

      if (nextRetryCount > queue.maxRetries) {
        logger.error('Order message exceeded retry limit', {
          queue: queue.dlq,
          failedQueue: queue.failedQueue,
          maxRetries: queue.maxRetries,
        });
        channel.ack(data);
        return;
      }
      await orderService.publishOrderEvent(data.content, queue.name, nextRetryCount);
    } catch (error) {
      logger.error('Error occurred while processing order DLQ message', { error: error.message });
    }
  });
};
