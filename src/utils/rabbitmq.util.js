const { getConnection } = require("../configs/rabbitmq.config");
const logger = require("./logger");

const publishToQueue = async (queueName, data) => {
  try {
    const connection = getConnection();
    if (!connection) {
      logger.warn("RabbitMQ connection not established, skipping message publish");
      return false;
    }

    const channel = await connection.createChannel();
    await channel.assertQueue(queueName, { durable: true });
    
    const content = Buffer.from(JSON.stringify(data));
    channel.sendToQueue(queueName, content, { persistent: true });
    
    // Close channel after use to prevent leak
    await channel.close();
    return true;
  } catch (error) {
    logger.error(`Error publishing to queue ${queueName}`, {
      error: error.message,
    });
    return false;
  }
};

module.exports = {
  publishToQueue,
};
