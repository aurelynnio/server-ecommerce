/**
 * Response cache cho chatbot (greeting/FAQ).
 * Cache theo hash(message) → response. TTL mặc định 1h.
 *
 * KHÔNG cache các câu hỏi dạng followup (chứa "nó", "trên", "vừa rồi"...)
 * vì phụ thuộc history.
 */

const crypto = require('crypto');
const redisClient = require('../configs/redis.config');
const logger = require('../utils/logger');

const KEY_PREFIX = 'chatbot:resp:';
const VERSION_KEY = 'chatbot:resp:ver';
const DEFAULT_TTL_SECONDS = Number(process.env.CHATBOT_CACHE_TTL) || 3600;

const ENABLED = String(process.env.CHATBOT_CACHE_ENABLED || 'true').toLowerCase() === 'true';

// Lưu ý: \b (word boundary) KHÔNG hoạt động đúng với tiếng Việt có dấu
// vì \w chỉ = [A-Za-z0-9_]. Dùng lookaround thay thế.
const FOLLOWUP_PATTERNS = [
  /(?<!\w)nó(?!\w)/i,
  /(?<!\w)cái đó(?!\w)/i,
  /(?<!\w)cái này(?!\w)/i,
  /(?<!\w)cái trên(?!\w)/i,
  /(?<!\w)ở trên(?!\w)/i,
  /(?<!\w)sản phẩm trên(?!\w)/i,
  /(?<!\w)mẫu trên(?!\w)/i,
  /(?<!\w)món trên(?!\w)/i,
  /(?<!\w)sản phẩm này(?!\w)/i,
  /(?<!\w)sản phẩm đó(?!\w)/i,
  /(?<!\w)mẫu này(?!\w)/i,
  /(?<!\w)mẫu đó(?!\w)/i,
  /(?<!\w)đơn này(?!\w)/i,
  /(?<!\w)đầu tiên(?!\w)/i,
  /(?<!\w)áo này(?!\w)/i,
  /(?<!\w)quần này(?!\w)/i,
  /(?<!\w)vừa rồi(?!\w)/i,
  /(?<!\w)vừa xem(?!\w)/i,
  /(?<!\w)vừa gợi ý(?!\w)/i,
  /(?<!\w)vừa giới thiệu(?!\w)/i,
  /(?<!\w)trước đó(?!\w)/i,
  /(?<!\w)vừa nói(?!\w)/i,
  /(?<!\w)thêm (nữa|chút|nhé)(?!\w)/i,
  /(?<!\w)nữa(?!\w)/i,
  /(?<!\w)so sánh(?!\w)/i,
  /(?<!\w)(tư vấn size|bảng size|chọn size|size gì|mặc size|chiều cao|cân nặng)(?!\w)/i,
];

const isFollowup = (message = '') => {
  const msg = String(message).trim();
  if (msg.length === 0) return true;
  if (msg.length < 3) return true;
  return FOLLOWUP_PATTERNS.some((p) => p.test(msg));
};

const hash = (s) =>
  crypto.createHash('sha256').update(String(s).toLowerCase().trim()).digest('hex').slice(0, 32);

const getCacheVersion = async () => {
  if (!redisClient?.isReady?.()) return '0';
  try {
    const version = await redisClient.get(VERSION_KEY);
    return version || '0';
  } catch {
    return '0';
  }
};

const bumpVersion = async () => {
  if (!redisClient?.isReady?.()) return null;
  try {
    const nextVersion = await redisClient.incr(VERSION_KEY);
    logger.debug?.('[ChatbotCache] Bumped cache version', { version: nextVersion });
    return nextVersion;
  } catch (err) {
    logger.warn('[ChatbotCache] bumpVersion error:', err.message);
    return null;
  }
};

const getCachedResponse = async (message) => {
  if (!ENABLED) return null;
  if (isFollowup(message)) return null;
  if (!redisClient?.isReady?.()) return null;

  try {
    const version = await getCacheVersion();
    const key = `${KEY_PREFIX}v${version}:${hash(message)}`;
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

  try {
    const version = await getCacheVersion();
    const key = `${KEY_PREFIX}v${version}:${hash(message)}`;
    await redisClient.set(key, JSON.stringify(response), 'EX', DEFAULT_TTL_SECONDS);
  } catch (err) {
    logger.warn('[ChatbotCache] SET error:', err.message);
  }
};

const invalidateAll = async () => {
  if (!redisClient?.isReady?.()) return 0;
  await bumpVersion();
  let cursor = '0';
  let deleted = 0;
  try {
    do {
      const [next, keys] = await redisClient.scan(cursor, 'MATCH', `${KEY_PREFIX}v*`, 'COUNT', 100);
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
  bumpVersion,
  getCacheVersion,
  invalidateAll,
  ENABLED,
  DEFAULT_TTL_SECONDS,
};
