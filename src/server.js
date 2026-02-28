require("dotenv").config();
const { server } = require("./app");
const connectDB = require("./db/connect.db");
const cluster = require("cluster");
const mongoose = require("mongoose");
const { initSocket, shutdownSocket } = require("./socket");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS =
  Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10 * 1000;

const redis = require("./configs/redis.config");
const { connectRabbitMQ } = require("./configs/rabbitMQ.config");
connectRabbitMQ();

const startServer = async () => {
  try {
    await connectDB();
    logger.info("Database connected successfully");

    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  const forceTimer = setTimeout(() => {
    logger.error("Force shutdown due to timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    await new Promise((resolve) => server.close(resolve));
  } catch (error) {
    logger.error("Error closing HTTP server:", { error: error.message });
  }

  await shutdownSocket();

  await Promise.allSettled([mongoose.connection.close(false), redis.quit?.()]);

  clearTimeout(forceTimer);
  process.exit(0);
};

const setupProcessHandlers = () => {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", { reason });
    shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", {
      message: error.message,
      stack: error.stack,
    });
    shutdown("uncaughtException");
  });
};

if (cluster.isPrimary && process.env.NODE_ENV === "production") {
  const numWorkers = require("os").cpus().length;
  logger.info(
    `Primary ${process.pid} is running in production mode. Forking ${numWorkers} workers...`,
  );

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, _code, _signal) => {
    logger.warn(`Worker ${worker.process.pid} died. Forking a new worker...`);
    cluster.fork();
  });

  process.on("SIGTERM", () => {
    logger.info("Primary received SIGTERM. Shutting down workers...");
    cluster.disconnect(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    logger.info("Primary received SIGINT. Shutting down workers...");
    cluster.disconnect(() => process.exit(0));
  });
} else {
  if (cluster.isPrimary) {
    logger.info(`Server starting in ${process.env.NODE_ENV} mode...`);
  }
  initSocket(server);
  setupProcessHandlers();
  startServer();
}
