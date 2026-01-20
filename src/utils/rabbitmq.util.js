const { getChannel } = require("../configs/rabbitmq.config");
const logger = require("./logger");

const publishToQueue = async (queueName, data) => {
  try {
    const channel = getChannel();
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
    logger.info(`Message sent to queue: ${queueName}`);
  } catch (error) {
    logger.error("RabbitMQ Publish Error:", error);
  }
};

const consumeFromQueue = async (queueName, callback) => {
  try {
    const channel = getChannel();
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    await channel.assertQueue(queueName, { durable: true });
    logger.info(`Waiting for messages in queue: ${queueName}`);

    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        const content = JSON.parse(msg.content.toString());
        try {
          await callback(content);
          channel.ack(msg);
        } catch (error) {
          logger.error("Error processing message:", error);
          channel.nack(msg, false, true);
        }
      }
    });
  } catch (error) {
    logger.error("RabbitMQ Consume Error:", error);
  }
};

module.exports = {
  publishToQueue,
  consumeFromQueue,
};
