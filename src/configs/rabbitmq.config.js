const rabbitMQ = require("amqplib");
const logger = require("../utils/logger");
const config_rabbitMQ = {
  url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
  queue: "notification_queue",
};

async function connectRabbitMQ() {
  try {
    const connection = await rabbitMQ.connect(config_rabbitMQ.url);
    if (!connection) throw new Error("Failed to establish RabbitMQ connection");
    const channel = await connection.createChannel();
    await channel.assertQueue(config_rabbitMQ.queue, { durable: true });
    logger.info("Connected to RabbitMQ and queue is ready");
    return { connection, channel };
  } catch (error) {
    logger.error("Failed to connect to RabbitMQ", error);
    throw error;
  }
}

module.exports = {
  connectRabbitMQ,
};
