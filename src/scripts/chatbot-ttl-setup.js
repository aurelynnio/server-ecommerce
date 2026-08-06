/**
 * One-time script: tạo TTL index trên collection chatbot_messages
 * dựa trên ObjectId timestamp (mỗi message có _id tự sinh chứa createdAt).
 *
 * Sau khi chạy, MongoDB sẽ tự xoá các message cũ hơn TTL_DAYS ngày.
 *
 * Chạy: node src/scripts/chatbot-ttl-setup.js
 *
 * Lưu ý: ObjectId TTL hoạt động vì _id ObjectId có timestamp ở 4 byte đầu.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const TTL_DAYS = Number(process.env.CHATBOT_TTL_DAYS) || 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

const ensureIndexes = async () => {
  const collection = mongoose.connection.collection('chatbot_messages');

  const existing = await collection.indexes();
  logger.info('[Chatbot-TTL] Existing indexes:', existing.map((i) => i.name));

  // TTL trên _id: Mongo sẽ xoá document khi _id.getTimestamp() + expireAfterSeconds < now
  await collection.createIndex(
    { _id: 1 },
    {
      name: 'chatbot_messages_ttl',
      expireAfterSeconds: TTL_SECONDS,
    },
  );
  logger.info(`[Chatbot-TTL] TTL index created (expireAfterSeconds=${TTL_SECONDS}s = ${TTL_DAYS}d)`);
};

(async () => {
  try {
    await require('../db/connect.db')();
    await ensureIndexes();
  } catch (err) {
    logger.error('[Chatbot-TTL] Setup failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
