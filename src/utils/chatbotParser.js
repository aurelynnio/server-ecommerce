/**
 * chatbotParser - Tách parsing logic từ chatbot.controller.js
 * 
 * Các hàm này chịu trách nhiệm parse message từ MongoDB/LangChain format
 * về dạng chuẩn { role, content, timestamp } cho frontend.
 */

const PRIORITY_TEXT_KEYS = ['content', 'text'];

const extractTextValue = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextValue(item))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (value && typeof value === 'object') {
    for (const key of PRIORITY_TEXT_KEYS) {
      const candidate = extractTextValue(value[key]);
      if (candidate) return candidate;
    }

    const nestedObjects = Object.values(value).filter(
      (item) => item && (Array.isArray(item) || typeof item === 'object'),
    );

    for (const item of nestedObjects) {
      const candidate = extractTextValue(item);
      if (candidate) return candidate;
    }
  }

  return '';
};

const extractMessageContent = (payload) => {
  const prioritizedSources = [
    payload?.data,
    payload?.message,
    payload?.lc_kwargs,
    payload,
  ];

  for (const source of prioritizedSources) {
    const extracted = extractTextValue(source);
    if (extracted) return extracted;
  }

  return '[Không đọc được nội dung tin nhắn]';
};

const normalizeRole = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();

  if (normalized === 'human' || normalized === 'user') return 'user';
  if (normalized === 'ai' || normalized === 'assistant') return 'assistant';

  return null;
};

const normalizeTimestamp = (value, fallbackTimestamp) => {
  if (value instanceof Date) return value;

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return fallbackTimestamp;
};

const extractConversationMessages = (payload, fallbackTimestamp = new Date()) => {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractConversationMessages(item, fallbackTimestamp));
  }

  if (typeof payload !== 'object') return [];

  const detectedRole =
    normalizeRole(payload.role) ||
    normalizeRole(payload.type) ||
    normalizeRole(payload?.data?.role) ||
    normalizeRole(payload?.data?.type);

  if (detectedRole) {
    return [
      {
        role: detectedRole,
        content: extractMessageContent(payload),
        timestamp: normalizeTimestamp(
          payload.timestamp || payload.createdAt || payload.updatedAt,
          fallbackTimestamp,
        ),
      },
    ];
  }

  const nestedSources = [
    payload.messages,
    payload.history,
    payload.items,
    payload.entries,
    payload.data,
    payload.message,
    payload.lc_kwargs,
  ].filter(Boolean);

  for (const source of nestedSources) {
    const nestedMessages = extractConversationMessages(source, fallbackTimestamp);
    if (nestedMessages.length > 0) return nestedMessages;
  }

  return [];
};

module.exports = {
  extractTextValue,
  extractMessageContent,
  normalizeRole,
  normalizeTimestamp,
  extractConversationMessages,
};