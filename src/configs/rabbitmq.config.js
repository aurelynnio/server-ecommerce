const amqp = require("amqplib");
const dotenv = require("dotenv");

dotenv.config();

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const amqpUrl =
      process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();

    console.log("RabbitMQ connected successfully");

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
    });

    connection.on("close", () => {
      console.log("RabbitMQ connection closed, reconnecting...");
      setTimeout(connectRabbitMQ, 5000);
    });

    return { connection, channel };
  } catch (error) {
    console.error("RabbitMQ connection failed:", error);
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
