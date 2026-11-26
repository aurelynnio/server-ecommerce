const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('../configs/redis.config');
const notificationSocket = require('./notification.socket');
const chatSocket = require('./chat.socket');
const socketAuthMiddleware = require('../middlewares/socketAuth.middleware');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { isAllowedOrigin } = require('../middlewares/cors.middleware');

let io = null;
let redisPubClient = null;
let redisSubClient = null;

const shouldUseRedisAdapter = () => {
  if (process.env.SOCKET_REDIS_ADAPTER === 'false') return false;
  return (
    process.env.SOCKET_REDIS_ADAPTER === 'true' ||
    process.env.ENABLE_CLUSTER === 'true' ||
    process.env.NODE_ENV === 'production'
  );
};

const setupRedisAdapter = async () => {
  if (!shouldUseRedisAdapter()) return;

  try {
    redisPubClient = redisClient.duplicate();
    redisSubClient = redisClient.duplicate();

    redisPubClient.on('error', (err) => {
      logger.error('Socket Redis pub client error:', { error: err.message });
    });
    redisSubClient.on('error', (err) => {
      logger.error('Socket Redis sub client error:', { error: err.message });
    });

    io.adapter(createAdapter(redisPubClient, redisSubClient));
    logger.info('Socket.io Redis adapter enabled (ioredis)');
  } catch (error) {
    logger.error('Failed to initialize Socket.io Redis adapter:', {
      error: error.message,
    });
  }
};

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setupRedisAdapter();

  // 1. Setup Middleware Authentication
  io.use(socketAuthMiddleware);

  // 2. Central Connection Handler
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id} (User ID: ${socket.user.id})`);

    const role = socket.user?.role || socket.user?.roles;
    if (role === 'admin' || (Array.isArray(role) && role.includes('admin'))) {
      socket.join('admin');
    }

    // Initialize handlers for this specific socket
    notificationSocket(io, socket);
    chatSocket(io, socket);

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Socket.io not initialized!');
  }

  return io;
};

const shutdownSocket = async () => {
  try {
    if (io) {
      io.close();
    }
    if (redisPubClient) {
      if (redisPubClient.status === 'ready') {
        await redisPubClient.quit();
      } else {
        redisPubClient.disconnect();
      }
      redisPubClient = null;
    }
    if (redisSubClient) {
      if (redisSubClient.status === 'ready') {
        await redisSubClient.quit();
      } else {
        redisSubClient.disconnect();
      }
      redisSubClient = null;
    }
  } catch (error) {
    logger.error('Failed to shutdown Socket.io:', { error: error.message });
  }
};

module.exports = { initSocket, getIO, shutdownSocket };
