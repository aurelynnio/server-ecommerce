const { getChannel } = require("../configs/rabbitmq.config");

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
    console.log(`Message sent to queue: ${queueName}`);
  } catch (error) {
    console.error("RabbitMQ Publish Error:", error);
  }
};

const consumeFromQueue = async (queueName, callback) => {
  try {
    const channel = getChannel();
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }
    await channel.assertQueue(queueName, { durable: true });
    console.log(`Waiting for messages in queue: ${queueName}`);

    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        const content = JSON.parse(msg.content.toString());
        try {
          await callback(content);
          channel.ack(msg);
        } catch (error) {
          console.error("Error processing message:", error);
          // Optionally nack to requeue
          channel.nack(msg, false, true);
        }
      }
    });
  } catch (error) {
    console.error("RabbitMQ Consume Error:", error);
  }
};

module.exports = {
  publishToQueue,
  consumeFromQueue,
};
