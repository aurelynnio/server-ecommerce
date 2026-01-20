const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  return await mongoose
    .connect(uri, {
      maxConnecting: 10,
      maxPoolSize: 10,
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
