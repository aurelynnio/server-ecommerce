/**
 * Response cache cho chatbot (greeting/FAQ).
 * Cache theo hash(message) → response. TTL mặc định 1h.
 *
 * KHÔNG cache các câu hỏi dạng followup (chứa "nó", "trên", "vừa rồi"...)
 * vì phụ thuộc history.
 */

const crypto = require('crypto');
const redisClient = require('../configs/redis.config');
const logger = require('./logger');

const KEY_PREFIX = 'chatbot:resp:';
const DEFAULT_TTL_SECONDS = Number(process.env.CHATBOT_CACHE_TTL) || 3600;

const ENABLED = String(process.env.CHATBOT_CACHE_ENABLED || 'true').toLowerCase() === 'true';

// Lưu ý: \b (word boundary) KHÔNG hoạt động đúng với tiếng Việt có dấu
// vì \w chỉ = [A-Za-z0-9_]. Dùng lookaround thay thế.
const FOLLOWUP_PATTERNS = [
  /(?<!\w)nó(?!\w)/i,
  /(?<!\w)cái đó(?!\w)/i,
  /(?<!\w)cái này(?!\w)/i,
  /(?<!\w)ở trên(?!\w)/i,
  /(?<!\w)vừa rồi(?!\w)/i,
  /(?<!\w)trước đó(?!\w)/i,
  /(?<!\w)vừa nói(?!\w)/i,
  /(?<!\w)thêm (nữa|chút|nhé)(?!\w)/i,
  /(?<!\w)nữa(?!\w)/i,
];

const isFollowup = (message = '') => {
  const msg = String(message).trim();
  if (msg.length === 0) return true;
  if (msg.length < 3) return true;
  return FOLLOWUP_PATTERNS.some((p) => p.test(msg));
};

const hash = (s) =>
  crypto.createHash('sha256').update(String(s).toLowerCase().trim()).digest('hex').slice(0, 32);

const getCachedResponse = async (message) => {
  if (!ENABLED) return null;
  if (isFollowup(message)) return null;
  if (!redisClient?.isReady?.()) return null;

  const key = `${KEY_PREFIX}${hash(message)}`;
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      logger.debug?.('[ChatbotCache] HIT', { key });
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn('[ChatbotCache] GET error:', err.message);
  }
  return null;
};

const setCachedResponse = async (message, response) => {
  if (!ENABLED) return;
  if (isFollowup(message)) return;
  if (!response?.success || !response?.message) return;
  if (!redisClient?.isReady?.()) return;

  const key = `${KEY_PREFIX}${hash(message)}`;
  try {
    await redisClient.setEx(key, DEFAULT_TTL_SECONDS, JSON.stringify(response));
  } catch (err) {
    logger.warn('[ChatbotCache] SET error:', err.message);
  }
};

const invalidateAll = async () => {
  if (!redisClient?.isReady?.()) return 0;
  let cursor = '0';
  let deleted = 0;
  try {
    do {
      const [next, keys] = await redisClient.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) {
        await redisClient.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('[ChatbotCache] invalidate error:', err.message);
  }
  return deleted;
};

module.exports = {
  getCachedResponse,
  setCachedResponse,
  isFollowup,
  invalidateAll,
  ENABLED,
  DEFAULT_TTL_SECONDS,
};
