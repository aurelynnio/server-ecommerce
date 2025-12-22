const redis = require("../configs/redis.config");

const setCache = async (key, value, expirySeconds = 3600) => {
  try {
    const stringValue = JSON.stringify(value);
    if (expirySeconds) {
      await redis.set(key, stringValue, "EX", expirySeconds);
    } else {
      await redis.set(key, stringValue);
    }
  } catch (error) {
    console.error("Redis Set Error:", error);
  }
};

const getCache = async (key) => {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Redis Get Error:", error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis Delete Error:", error);
  }
};

module.exports = {
  setCache,
  getCache,
  deleteCache,
};
