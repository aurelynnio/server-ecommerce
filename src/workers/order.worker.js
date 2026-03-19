const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const logger = require('../utils/logger');

const consumerOrderQueue = async () => {
  try {
    const { channel, queue } = await connectRabbitMQ('order', { clientName: 'consumer' });
    await channel.consume(
      queue.name,
      (msg) => {
        if (!msg) return;
        try {
          logger.info('Received message from order queue', { msg: msg.content.toString() });
          channel.ack(msg);
        } catch (error) {
          logger.error('Error occurred while processing order message', {
            error: error.message,
          });
          channel.nack(msg, false, false);
        }
      },
      {
        noAck: false,
        prefetch: 10,
      },
    );
  } catch (e) {
    logger.error('Error occurred while consuming order queue', e);
  }
};

if (require.main === module) {
  consumerOrderQueue().catch(logger.error);
}

module.exports = consumerOrderQueue;
