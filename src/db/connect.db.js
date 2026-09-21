const mongoose = require('mongoose');
const logger = require('../utils/logger');

const buildMongoUriFromParts = () => {
  const db = process.env.MONGODB_DATABASE;
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  if (!db || !user || !pass) return null;

  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';

  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(
    pass,
  )}@${host}:${port}/${db}?authSource=${encodeURIComponent(authSource)}`;
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || buildMongoUriFromParts();
  const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE) || 25;
  const minPoolSize = Number(process.env.MONGO_MIN_POOL_SIZE) || 0;
  const maxConnecting = Number(process.env.MONGO_MAX_CONNECTING) || 5;

  if (!uri) {
    throw new Error(
      'Missing MongoDB config. Set MONGODB_URI, or set MONGODB_DATABASE/MONGODB_USER/MONGODB_PASSWORD (and MONGODB_HOST for Docker).',
    );
  }

  try {
    await mongoose.connect(uri, {
      maxConnecting,
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 15000,
      socketTimeoutMS: 45000,
      waitQueueTimeoutMS: 10000,
    });
    logger.info(`MongoDB connected: ${uri.includes('srv') ? 'Atlas (Cloud)' : 'Mongo'}`);
  } catch (error) {
    logger.error('MongoDB connection error', { error });
    throw error;
  }
};

module.exports = connectDB;
