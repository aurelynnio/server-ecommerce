require("dotenv").config();
const { server } = require("./app");
const connectDB = require("./db/connect.db");
const cluster = require("cluster");
const { initSocket } = require("./socket");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;

initSocket(server);

const { connectRabbitMQ } = require("./configs/rabbitmq.config");
const redis = require("./configs/redis.config");

const startServer = async () => {
  try {
    await connectDB();
    logger.info("Database connected successfully");

    await connectRabbitMQ();

    // Initialize Workers
    const { initWorkers } = require("./workers");
    await initWorkers();

    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

if (cluster.isPrimary && process.env.NODE_ENV === "production") {
  const numWorkers = require("os").cpus().length;
  logger.info(
    `Primary ${process.pid} is running in production mode. Forking ${numWorkers} workers...`,
  );

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died. Forking a new worker...`);
    cluster.fork();
  });
} else {
  if (cluster.isPrimary) {
    logger.info(`Server starting in ${process.env.NODE_ENV} mode...`);
  }
  startServer();
}
