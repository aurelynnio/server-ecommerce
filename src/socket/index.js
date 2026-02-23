const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const notificationSocket = require("./notification.socket");
const chatSocket = require("./chat.socket");
const socketAuthMiddleware = require("../middlewares/socketAuth.middleware");
const logger = require("../utils/logger");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

let io = null;
let redisPubClient = null;
let redisSubClient = null;

const shouldUseRedisAdapter = () => {
  if (process.env.SOCKET_REDIS_ADAPTER === "false") return false;
  return (
    process.env.SOCKET_REDIS_ADAPTER === "true" ||
    process.env.NODE_ENV === "production"
  );
};

const buildRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "localhost";
  const port = process.env.REDIS_PORT || 6379;
  const password = process.env.REDIS_PASSWORD;
  const authPart = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${authPart}${host}:${port}`;
};

const setupRedisAdapter = async () => {
  if (!shouldUseRedisAdapter()) return;

  try {
    const url = buildRedisUrl();
    redisPubClient = createClient({ url });
    redisSubClient = redisPubClient.duplicate();

    redisPubClient.on("error", (err) => {
      logger.error("Socket Redis pub client error:", { error: err.message });
    });
    redisSubClient.on("error", (err) => {
      logger.error("Socket Redis sub client error:", { error: err.message });
    });

    await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
    io.adapter(createAdapter(redisPubClient, redisSubClient));
    logger.info("Socket.io Redis adapter enabled");
  } catch (error) {
    logger.error("Failed to initialize Socket.io Redis adapter:", {
      error: error.message,
    });
  }
};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  setupRedisAdapter();

  // 1. Setup Middleware Authentication
  io.use(socketAuthMiddleware);

  // 2. Central Connection Handler
  io.on("connection", (socket) => {
    logger.info(`User connected: ${socket.id} (User ID: ${socket.user.id})`);

    // Initialize handlers for this specific socket
    notificationSocket(io, socket);
    chatSocket(io, socket);

    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      "Socket.io not initialized!",
    );
  }

  return io;
};

const shutdownSocket = async () => {
  try {
    if (io) {
      io.close();
    }
    if (redisPubClient) {
      await redisPubClient.quit();
      redisPubClient = null;
    }
    if (redisSubClient) {
      await redisSubClient.quit();
      redisSubClient = null;
    }
  } catch (error) {
    logger.error("Failed to shutdown Socket.io:", { error: error.message });
  }
};

module.exports = { initSocket, getIO, shutdownSocket };
