const cors = require("cors");
const logger = require("../utils/logger");

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://etiso.me",
];

/**
 * Get allowed origins
 * @returns {any}
 */
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
  }
  return defaultDevOrigins;
};

/**
 * Is localhost origin
 * @param {any} origin
 * @returns {boolean}
 */
const isLocalhostOrigin = (origin) => {
  return typeof origin === "string" && origin.startsWith("http://localhost");
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== "production" && isLocalhostOrigin(origin)) {
      return callback(null, true);
    }

    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(`Blocked by CORS: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
};

module.exports = cors(corsOptions);
