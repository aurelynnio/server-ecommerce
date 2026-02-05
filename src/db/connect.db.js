const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const maxPoolSize = Number(process.env.MONGO_MAX_POOL_SIZE) || 10;
  const minPoolSize = Number(process.env.MONGO_MIN_POOL_SIZE) || 0;
  const maxConnecting = Number(process.env.MONGO_MAX_CONNECTING) || 10;

  return await mongoose
    .connect(uri, {
      maxConnecting,
      maxPoolSize,
      minPoolSize,
    })
    .then(() => {
      logger.info(
        `MongoDB connected: ${
          uri.includes("srv") ? "Atlas (Cloud)" : "Localhost"
        }`,
      );
    })
    .catch((error) => {
      logger.error("MongoDB connection error:", error);
      process.exit(1);
    });
};

module.exports = connectDB;
