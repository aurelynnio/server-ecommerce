const Redis = require("ioredis");
const dotenv = require("dotenv");

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const redis = new Redis(redisConfig);

redis.on("connect", () => {
  console.log("Redis client connected");
});

redis.on("error", (err) => {
  console.error("Redis client error:", err);
});

module.exports = redis;
