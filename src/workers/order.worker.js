const { connectRabbitMQ } = require('../configs/rabbitMQ.config');
const logger = require('../utils/logger');

const Reconnect_delay_ms = Number(process.env.RABBITMQ_RECONNECT_DELAY_MS) || 5000;

let timer = null;
let workerReady = false;

const scheduleReconnect = () => {
  if (timer) return;

  timer = setTimeout(() => {}, Reconnect_delay_ms);
};

const consumerOrderQueue = async () => {
  try {
    const { channel, queue } = await connectRabbitMQ('order');
    await channel.prefetch(10);
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
