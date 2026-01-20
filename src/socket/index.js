const { Server } = require("socket.io");
const notificationSocket = require("./notification.socket");
const chatSocket = require("./chat.socket");
const socketAuthMiddleware = require("../middlewares/socketAuth.middleware");
const logger = require("../utils/logger");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

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
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIO };
