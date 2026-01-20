const amqp = require("amqplib");
const dotenv = require("dotenv");
const logger = require("../utils/logger");

dotenv.config();

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const amqpUrl =
      process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();

    logger.info("RabbitMQ connected successfully");

    connection.on("error", (err) => {
      logger.error("RabbitMQ connection error:", { error: err.message });
    });

    connection.on("close", () => {
      logger.info("RabbitMQ connection closed, reconnecting...");
      setTimeout(connectRabbitMQ, 5000);
    });

    return { connection, channel };
  } catch (error) {
    logger.error("RabbitMQ connection failed:", { error: error.message });
    setTimeout(connectRabbitMQ, 5000);
  }
};

const getChannel = () => channel;
const getConnection = () => connection;

module.exports = {
  connectRabbitMQ,
  getChannel,
  getConnection,
};
