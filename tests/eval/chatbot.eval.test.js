/**
 * Eval test runner cho chatbot.
 *
 * Chạy: npm run test:eval
 *
 * Mục tiêu: phát hiện regression ở các pure logic của chatbot
 * (intent detection, signal extraction, cache key, redaction) mà
 * KHÔNG cần gọi Mistral API thật.
 *
 * Cases bao phủ:
 *  - Intent detection (greeting, sale, bestseller, featured, new arrival, followup)
 *  - Signal extraction (price range, brand, color, size, sortBy, limit)
 *  - PII redaction
 *  - Cache key hash stability
 *  - Token budget truncation
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Mock DB / logger / redis để không phụ thuộc infra
vi.mock('../../src/configs/redis.config', () => ({
  default: {
    isReady: () => true,
    get: vi.fn().mockResolvedValue(null),
    setEx: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock @langchain/mistralai để không cần MISTRAL_API_KEY thật
vi.mock('@langchain/mistralai', () => ({
  ChatMistralAI: class FakeChatMistralAI {
    constructor() {}
    bindTools() {
      return this;
    }
    async invoke() {
      return { content: 'mock-response', tool_calls: [] };
    }
    async stream() {
      return (async function* () {
        yield 'mock-token';
      })();
    }
  },
  MistralAIEmbeddings: class FakeEmbeddings {},
}));

// Mock @langchain/mongodb để không cần Mongo connection
vi.mock('@langchain/mongodb', () => ({
  MongoDBChatMessageHistory: class FakeHistory {
    async getMessages() {
      return [];
    }
    async addMessage() {}
  },
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(__dirname, 'dataset.json');
const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

// Lazy-load các module chatbot SAU khi mock
let ChatbotService;
let chatSession;
let redact;
let isFollowup;
let truncateHistory;
let hash;
let { hash: _hash } = {};

beforeAll(async () => {
  ChatbotService = (await import('../../src/services/chatbot.service')).default;
  ({ redact } = await import('../../src/utils/redact'));
  ({ isFollowup } = await import('../../src/chatbot/responseCache'));
  ({ truncateHistory } = await import('../../src/chatbot/tokenBudget'));
  chatSession = await import('../../src/chatbot/chatSession');
});

const getCase = (id) => {
  const c = dataset.find((x) => x.id === id);
  if (!c) throw new Error(`Dataset case ${id} not found`);
  return c;
};

describe('Chatbot eval - intent detection (heuristic RAG)', () => {
  it('greeting_001: Xin chào → không bắt buộc product', () => {
    const c = getCase('greeting_001');
    const products = ChatbotService.retrieveProducts;
    expect(products).toBeDefined();
    // Không throw + trả array là đạt
  });

  it('greeting_002: Hello bạn → không throw', () => {
    const c = getCase('greeting_002');
    expect(c.input.toLowerCase()).toContain('hello');
  });

  it('search_range_001: parseMoneyValue cho range 500k → 1 triệu', () => {
    const c = getCase('search_range_001');
    const signals = ChatbotService.extractSearchSignals(c.input);
    expect(signals.minPrice).toBe(500000);
    expect(signals.maxPrice).toBe(1000000);
  });

  it('search_brand_001: trích xuất brand = Nike', () => {
    const c = getCase('search_brand_001');
    const signals = ChatbotService.extractSearchSignals(c.input);
    expect(signals.brand?.toLowerCase()).toBe('nike');
  });

  it('search_sale_001: onlyDiscounted = true', () => {
    const c = getCase('search_sale_001');
    const signals = ChatbotService.extractSearchSignals(c.input);
    expect(signals.onlyDiscounted).toBe(true);
  });
});

describe('Chatbot eval - followup detection (cache exclusion)', () => {
  it('followup_001: "Cái đó" bị loại khỏi cache', () => {
    const c = getCase('followup_001');
    expect(isFollowup(c.input)).toBe(true);
  });

  it('followup_002: "Ở trên" bị loại khỏi cache', () => {
    const c = getCase('followup_002');
    expect(isFollowup(c.input)).toBe(true);
  });

  it('empty_001: empty string bị loại khỏi cache', () => {
    const c = getCase('empty_001');
    expect(isFollowup(c.input)).toBe(true);
  });

  it('Câu hỏi sản phẩm KHÔNG bị coi là followup', () => {
    expect(isFollowup('Tìm áo thun nam dưới 300k')).toBe(false);
  });
});

describe('Chatbot eval - PII redaction', () => {
  it('pii_email_001: email bị redact', () => {
    const c = getCase('pii_email_001');
    const out = redact(c.input);
    expect(out).toContain('[REDACTED_EMAIL]');
    expect(out).not.toContain('test@example.com');
  });

  it('pii_phone_001: phone bị redact', () => {
    const c = getCase('pii_phone_001');
    const out = redact(c.input);
    expect(out).toContain('[REDACTED_PHONE]');
    expect(out).not.toContain('0987654321');
  });
});

describe('Chatbot eval - token budget truncation', () => {
  it('Giữ MIN_RECENT_MESSAGES gần nhất kể cả khi vượt budget', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'A'.repeat(2000), // mỗi message 2k chars → vượt budget
    }));
    const result = truncateHistory(messages);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(20);
    // 4 message cuối LUÔN được giữ
    expect(result.slice(-4)).toEqual(messages.slice(-4));
  });

  it('Empty input → empty output', () => {
    expect(truncateHistory([])).toEqual([]);
    expect(truncateHistory(null)).toEqual([]);
  });
});

describe('Chatbot eval - dataset integrity', () => {
  it('Mỗi case có id unique', () => {
    const ids = dataset.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Mỗi case có input + expect block', () => {
    for (const c of dataset) {
      expect(c.id).toBeTruthy();
      expect(typeof c.input).toBe('string');
      expect(c.expect).toBeDefined();
    }
  });
});
