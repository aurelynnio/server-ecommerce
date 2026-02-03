const { getConnection } = require("../configs/rabbitmq.config");
const logger = require("./logger");

const consumeFromQueue = async (queueName, handler) => {
  try {
    const connection = getConnection();
    if (!connection) {
      logger.warn("RabbitMQ connection not established, skipping consumption");
      return;
    }

    const channel = await connection.createChannel();
    await channel.assertQueue(queueName, { durable: true });

    await channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        await handler(data);
        channel.ack(msg);
      } catch (error) {
        logger.error("Failed to process queue message", { error: error.message });
        channel.nack(msg, false, false);
      }
    });
  } catch (error) {
    logger.error(`Error consuming from queue ${queueName}`, {
      error: error.message,
    });
  }
};

module.exports = {
  consumeFromQueue,
};
