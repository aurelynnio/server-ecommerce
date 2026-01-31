const amqp = require("amqplib");
const logger = require("../utils/logger");

let connection = null;

const connectRabbitMQ = async () => {
  try {
    const amqpServer = process.env.RABBITMQ_URI || "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer);
    logger.info("Connected to RabbitMQ");
    return connection;
  } catch (error) {
    logger.error("Failed to connect to RabbitMQ", { error: error.message });
    return null;
  }
};

const getConnection = () => connection;

module.exports = {
  connectRabbitMQ,
  getConnection,
};
