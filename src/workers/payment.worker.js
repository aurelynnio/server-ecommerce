const logger = require('../utils/logger');
const { connectRabbitMQ } = require('../configs/rabbitMQ.config');

const consumerPaymentQueue = async () => {
  try {
    const { channel, queue } = await connectRabbitMQ('payment');
    await channel.prefetch(10);
    await channel.consume(
      queue.name,
      (msg) => {
        if (!msg) return;
        try {
          logger.info('Received message from payment queue', { msg: msg.content.toString() });
          channel.ack(msg);
        } catch (error) {
          logger.error('Error occurred while processing payment message', {
            error: error.message,
          });
          channel.nack(msg, false, false);
        }
      },
      {
        noAck: false,
      },
    );
  } catch (e) {
    logger.error('Error occurred while consuming payment queue', e);
  }
};

if (require.main === module) {
  consumerPaymentQueue().catch(logger.error);
}

module.exports = consumerPaymentQueue;
