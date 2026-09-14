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
  logger.info(
    '[Chatbot-TTL] Existing indexes:',
    existing.map((i) => i.name),
  );

  // Drop old broken TTL index on _id if it exists (TTL on ObjectId never fires)
  const oldTtl = existing.find((i) => i.name === 'chatbot_messages_ttl');
  if (oldTtl) {
    logger.info('[Chatbot-TTL] Dropping broken TTL index on _id');
    await collection.dropIndex('chatbot_messages_ttl');
  }

  // TTL index on createdAt field (Date type) — MongoDB will auto-delete expired docs
  await collection.createIndex(
    { createdAt: 1 },
    {
      name: 'chatbot_messages_ttl_v2',
      expireAfterSeconds: TTL_SECONDS,
    },
  );
  logger.info(
    `[Chatbot-TTL] TTL index created on createdAt (expireAfterSeconds=${TTL_SECONDS}s = ${TTL_DAYS}d)`,
  );

  // Index on sessionId for fast lookups (getHistory, clearSession, etc.)
  await collection.createIndex({ sessionId: 1 }, { name: 'chatbot_messages_sessionId' });
  logger.info('[Chatbot-TTL] sessionId index created');

  // Backfill: set createdAt from ObjectId timestamp for existing docs without it
  const backfillResult = await collection.updateMany({ createdAt: { $exists: false } }, [
    { $set: { createdAt: { $toDate: '$_id' } } },
  ]);
  if (backfillResult.modifiedCount > 0) {
    logger.info(
      `[Chatbot-TTL] Backfilled createdAt for ${backfillResult.modifiedCount} existing documents`,
    );
  }
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
