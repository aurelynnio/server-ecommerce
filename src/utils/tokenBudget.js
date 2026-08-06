// Token budget utility for chatbot history truncation.
// Mistral rule of thumb: 1 token ≈ 4 chars cho tiếng Anh / tiếng Việt không dấu;
// tiếng Việt có dấu thường ~3 chars/token. Lấy conservative: 3.
const CHARS_PER_TOKEN = 3;

// Giới hạn tổng số chars của history đưa vào prompt (~3k tokens ≈ 9k chars).
const HISTORY_CHAR_BUDGET = Number(process.env.CHATBOT_HISTORY_CHAR_BUDGET) || 9000;

// Giữ tối thiểu N message gần nhất, kể cả khi vượt budget (để không mất context).
const MIN_RECENT_MESSAGES = Number(process.env.CHATBOT_MIN_RECENT_MESSAGES) || 4;

const normalizeMessage = (m) => {
  if (typeof m === 'string') return { content: m };
  return {
    role: m.role || m.type || 'user',
    content:
      typeof m.content === 'string'
        ? m.content
        : typeof m.text === 'string'
          ? m.text
          : '',
  };
};

const truncateHistory = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const normalized = messages.map(normalizeMessage).filter((m) => m.content);

  // Luôn giữ MIN_RECENT_MESSAGES message cuối
  if (normalized.length <= MIN_RECENT_MESSAGES) return normalized;

  const recent = normalized.slice(-MIN_RECENT_MESSAGES);
  const older = normalized.slice(0, -MIN_RECENT_MESSAGES);

  let remaining = HISTORY_CHAR_BUDGET;
  for (const m of recent) {
    remaining -= m.content.length;
  }

  const keptOlder = [];
  for (let i = older.length - 1; i >= 0; i--) {
    const m = older[i];
    if (remaining - m.content.length < 0) break;
    keptOlder.unshift(m);
    remaining -= m.content.length;
  }

  return [...keptOlder, ...recent];
};

module.exports = {
  truncateHistory,
  HISTORY_CHAR_BUDGET,
  MIN_RECENT_MESSAGES,
  CHARS_PER_TOKEN,
};
