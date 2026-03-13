const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

const consumerNotificationQueue = async () => {
  try {
    const { channel, queue } = await connectRabbitMQ('notification');
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
  } catch (error) {
    logger.error('Error occurred while consuming notification queue', error);
  }
};

if (require.main === module) {
  consumerNotificationQueue().catch(logger.error);
}

module.exports = consumerNotificationQueue;
