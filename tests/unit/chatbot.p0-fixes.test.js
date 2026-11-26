import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const { validateResponse, collectGroundedAmounts } = require('../../src/chatbot/chatbotHelpers');
const { isFollowup } = require('../../src/chatbot/responseCache');
const { resolveChatSession, signChatSession, COOKIE_NAME } = require('../../src/chatbot/chatSession');
const { addToCartValidator } = require('../../src/validations/cart.validator');
const {
  feedbackValidator,
  sessionIdParamValidator,
} = require('../../src/validations/chatbot.validator');
const ChatbotAgent = require('../../src/chatbot/chatAgent');
const { toolHandlers, getProductAvailability } = require('../../src/chatbot/chatbot.tools');

describe('Chatbot P0 fixes (real modules)', () => {
  describe('validateResponse (chatbotHelpers)', () => {
    it('blocks javascript: and data: URIs while allowing category url and variant/checkout prices & images', () => {
      const products = [
        {
          name: 'Áo thun',
          price: 199000,
          originalPrice: 250000,
          productUrl: '/products/ao-thun',
          checkoutUrl: '/checkout?product=507f1f77bcf86cd799439011',
          addToCartUrl: '/cart/add?product=507f1f77bcf86cd799439011&quantity=1',
          variants: [{ price: 215000, image: 'https://res.cloudinary.com/demo/img.jpg' }],
        },
        {
          name: 'Áo nam',
          slug: 'ao-nam',
          url: '/categories/ao-nam',
        },
      ];

      expect(validateResponse('Xem [hack](javascript:alert(1))', products)).toContain(
        'không thể truy cập',
      );
      expect(validateResponse('Xem [hack](data:text/html,<script>1</script>)', products)).toContain(
        'không thể truy cập',
      );

      const validCategoryAndVariant =
        '![Áo](https://res.cloudinary.com/demo/img.jpg)\nDanh mục [Áo nam](/categories/ao-nam), còn 3 đôi size 40 đang sẵn, giá biến thể 215.000đ, [Xem](/products/ao-thun)';
      expect(validateResponse(validCategoryAndVariant, products)).toBe(validCategoryAndVariant);

      // Unseparated hallucinated prices >= 100,000đ and 4-digit empty-context prices must be caught
      expect(validateResponse('Giá bịa 200000đ', [{ price: 50000 }])).toContain('chưa thể xác nhận');
      expect(validateResponse('Giá bịa 150000đ', [{ price: 50000 }])).toContain('chưa thể xác nhận');
      expect(validateResponse('Áo giá 5.000đ', [])).toContain('chưa tìm thấy');
    });

    it('keeps policy/voucher money when amounts come from grounded tools', () => {
      const answer =
        'Miễn phí vận chuyển cho đơn từ 500.000đ. Phí ship tiêu chuẩn 30.000đ, tối đa 50.000đ.';

      expect(validateResponse(answer, [])).toContain('chưa tìm thấy');
      expect(validateResponse(answer, [], null, { allowedAmounts: [500000, 30000] })).toContain(
        'chưa tìm thấy',
      );
      expect(
        validateResponse(answer, [], null, { allowedAmounts: [500000, 30000, 50000] }),
      ).toBe(answer);
    });

    it('collects money values from policy and voucher tool payloads', () => {
      const amounts = collectGroundedAmounts([
        {
          minOrderValue: 500000,
          value: 30000,
          maxValue: 50000,
          content: 'Đơn từ 1.000.000đ được freeship toàn quốc.',
        },
      ]);

      expect(new Set(amounts)).toEqual(new Set([500000, 30000, 50000, 1000000]));
    });
  });

  describe('sessionIdParamValidator', () => {
    it('rejects empty string sessionId params', () => {
      expect(sessionIdParamValidator.validate({ sessionId: '' }).error).toBeDefined();
    });
  });

  describe('feedbackValidator', () => {
    it('validates required feedback fields and limits comments', () => {
      const valid = feedbackValidator.validate({
        sessionId: 'b484594c-47b2-4d2b-bbd7-133e9d8e578c',
        messageId: '65df8a76b91234567890abcd:1',
        rating: 'down',
        comment: 'Useful feedback',
      });
      expect(valid.error).toBeUndefined();

      expect(
        feedbackValidator.validate({
          sessionId: 'b484594c-47b2-4d2b-bbd7-133e9d8e578c',
          messageId: 'message-1',
          rating: 'invalid',
        }).error,
      ).toBeDefined();
      expect(
        feedbackValidator.validate({
          sessionId: 'b484594c-47b2-4d2b-bbd7-133e9d8e578c',
          messageId: 'message-1',
          rating: 'up',
          comment: 'a'.repeat(501),
        }).error,
      ).toBeDefined();
    });
  });

  describe('getProductAvailability', () => {
    it('uses product stock for simple products without variants', () => {
      const result = getProductAvailability(
        {
          _id: '507f1f77bcf86cd799439011',
          stock: 7,
          variants: [],
        },
        undefined,
        undefined,
      );

      expect(result.available).toBe(true);
      expect(result.totalStock).toBe(7);
      expect(result.checkoutUrl).toBe('/checkout?product=507f1f77bcf86cd799439011');
    });

    it('checks product-level numeric sizes and rejects unsupported colors', () => {
      const product = {
        _id: '507f1f77bcf86cd799439011',
        stock: 4,
        sizes: ['39', '40'],
        variants: [],
      };

      expect(getProductAvailability(product, '40').available).toBe(true);
      expect(getProductAvailability(product, '41').available).toBe(false);
      expect(getProductAvailability(product, undefined, 'Đen').available).toBe(false);
    });

    it('filters variants by size and color and generates variant checkoutUrl', () => {
      const product = {
        _id: '507f1f77bcf86cd799439011',
        variants: [
          { _id: 'var1', size: 'L', color: 'Trắng', stock: 5, price: 150000 },
          { _id: 'var2', size: 'M', color: 'Trắng', stock: 0, price: 150000 },
          { _id: 'var3', size: 'L', color: 'Đen', stock: 3, price: 160000 },
        ],
      };

      const inStock = getProductAvailability(product, 'L', 'Trắng');
      expect(inStock.available).toBe(true);
      expect(inStock.totalStock).toBe(5);
      expect(inStock.checkoutUrl).toBe('/checkout?product=507f1f77bcf86cd799439011&variant=var1&size=L');

      const outOfStock = getProductAvailability(product, 'M', 'Trắng');
      expect(outOfStock.available).toBe(false);
      expect(outOfStock.totalStock).toBe(0);
      expect(outOfStock.checkoutUrl).toBeNull();
    });
  });

  describe('responseCache.isFollowup', () => {
    it('detects session-contextual and size queries so they are not globally cached', () => {
      expect(isFollowup('tư vấn size cho các sản phẩm trên')).toBe(true);
      expect(isFollowup('áo này có màu đen không')).toBe(true);
      expect(isFollowup('so sánh 2 mẫu giúp mình')).toBe(true);
      expect(isFollowup('chiều cao 1m70 cân nặng 65kg mặc size gì')).toBe(true);
      expect(isFollowup('tìm áo thun nam cotton')).toBe(false);
    });
  });

  describe('chatSession.resolveChatSession', () => {
    it('clears expired/invalid cookie and issues a fresh session when no sessionId is requested', () => {
      process.env.CHAT_SESSION_SECRET = 'test-secret-for-p0';
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      };
      const req = {
        cookies: { [COOKIE_NAME]: 'not-a-valid-jwt' },
      };

      const freshId = resolveChatSession(req, res, undefined);
      expect(typeof freshId).toBe('string');
      expect(freshId.length).toBeGreaterThan(10);
      expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME, expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, expect.any(String), expect.any(Object));
    });

    it('clears invalid cookie and still rejects with 403 when an explicit sessionId is asserted', () => {
      process.env.CHAT_SESSION_SECRET = 'test-secret-for-p0';
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      };
      const req = {
        cookies: { [COOKIE_NAME]: 'not-a-valid-jwt' },
      };

      expect(() => resolveChatSession(req, res, 'some-other-session')).toThrow(
        'Invalid or expired chat session',
      );
      expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME, expect.any(Object));
    });
  });

  describe('ChatbotAgent tool schema & raw product collection', () => {
    it('binds full OpenAI-format toolDefinitions with parameters instead of DynamicTool', () => {
      const fakeModel = { bindTools: vi.fn() };
      const agent = new ChatbotAgent(fakeModel, () => ({ getMessages: async () => [] }));

      const searchByBrand = agent.tools.find((t) => t.function?.name === 'search_products_by_brand');
      expect(searchByBrand).toBeDefined();
      expect(searchByBrand.function.parameters.properties).toHaveProperty('brand');
      expect(searchByBrand.function.parameters.required).toContain('brand');
    });

    it('does not expose text emitted before a later tool call as assistant output', async () => {
      let streamCalls = 0;
      const model = {
        bindTools: () => ({
          stream: async function* () {
            streamCalls += 1;
            if (streamCalls === 1) {
              yield {
                content: 'internal preamble',
                tool_call_chunks: [],
                tool_calls: [],
                concat(other) {
                  return {
                    content: this.content + other.content,
                    tool_call_chunks: [...this.tool_call_chunks, ...other.tool_call_chunks],
                    tool_calls: other.tool_calls,
                    concat: this.concat,
                  };
                },
              };
              yield {
                content: '',
                tool_call_chunks: [{ index: 0 }],
                tool_calls: [{ id: 'tool-1', name: 'search_products', args: {} }],
              };
              return;
            }
            yield { content: 'final answer', tool_calls: [] };
          },
        }),
      };
      const history = {
        getMessages: async () => [],
        addMessage: vi.fn(),
      };
      const agent = new ChatbotAgent(model, () => history);
      agent._runToolCalls = async function* () {};

      const events = [];
      for await (const event of agent.stream('session-1', 'find products')) {
        events.push(event);
      }

      expect(events.filter((event) => event.type === 'token').map((event) => event.content)).toEqual([
        'final answer',
      ]);
    });

    it('does not replace a policy answer whose money came from search_store_policies', async () => {
      const policyAnswer =
        'Miễn phí vận chuyển cho đơn từ 500.000đ. Phí ship tiêu chuẩn 30.000đ.';
      const policySpy = vi.spyOn(toolHandlers, 'search_store_policies').mockResolvedValue([
        {
          key: 'freeship',
          type: 'freeship',
          title: 'Chính sách freeship',
          content: policyAnswer,
          source: 'approved-policy',
        },
      ]);

      let streamCalls = 0;
      const model = {
        bindTools: () => ({
          stream: async function* () {
            streamCalls += 1;
            if (streamCalls === 1) {
              yield {
                content: '',
                tool_call_chunks: [{ index: 0 }],
                tool_calls: [{ id: 'tool-1', name: 'search_store_policies', args: {} }],
              };
              return;
            }
            yield { content: policyAnswer, tool_calls: [] };
          },
        }),
      };
      const history = { getMessages: async () => [], addMessage: vi.fn() };
      const agent = new ChatbotAgent(model, () => history);

      const events = [];
      for await (const event of agent.stream('session-policy', 'phí ship bao nhiêu')) {
        events.push(event);
      }

      expect(events.filter((event) => event.type === 'correction')).toHaveLength(0);
      const tokens = events
        .filter((event) => event.type === 'token')
        .map((event) => event.content)
        .join('');
      expect(tokens).toContain('500.000đ');

      policySpy.mockRestore();
    });

    it('preserves grounded product details and compare_products replies without false hallucination', async () => {
      const detailsSpy = vi.spyOn(toolHandlers, 'get_product_details').mockResolvedValue({
        id: 'p-1',
        name: 'Áo thun cotton',
        slug: 'ao-thun-cotton',
        price: 199000,
        originalPrice: 250000,
        productUrl: '/products/ao-thun-cotton',
        checkoutUrl: '/checkout?product=p-1',
      });
      const compareSpy = vi.spyOn(toolHandlers, 'compare_products').mockResolvedValue([
        {
          id: 'p-1',
          name: 'Áo thun cotton',
          price: 199000,
          productUrl: '/products/ao-thun-cotton',
          checkoutUrl: '/checkout?product=p-1',
        },
        {
          id: 'p-2',
          name: 'Áo polo nam',
          price: 299000,
          productUrl: '/products/ao-polo-nam',
          checkoutUrl: '/checkout?product=p-2',
        },
      ]);

      let invokeCalls = 0;
      const model = {
        bindTools: () => ({
          invoke: async () => {
            invokeCalls += 1;
            if (invokeCalls === 1) {
              return {
                content: '',
                tool_calls: [{ id: 'tc-1', name: 'get_product_details', args: { productId: 'p-1' } }],
              };
            }
            if (invokeCalls === 2) {
              return {
                content: 'Áo thun cotton giá 199.000đ [Xem sản phẩm](/products/ao-thun-cotton).',
                tool_calls: [],
              };
            }
            if (invokeCalls === 3) {
              return {
                content: '',
                tool_calls: [
                  { id: 'tc-2', name: 'compare_products', args: { productIds: ['p-1', 'p-2'] } },
                ],
              };
            }
            return {
              content: 'Áo thun cotton 199.000đ rẻ hơn Áo polo nam 299.000đ.',
              tool_calls: [],
            };
          },
        }),
      };
      const history = { getMessages: async () => [], addMessage: vi.fn() };
      const agent = new ChatbotAgent(model, () => history);

      const detailsRes = await agent.invoke('session-details', 'chi tiết áo thun');
      expect(detailsRes.message).toContain('199.000đ');
      expect(detailsRes.message).toContain('/products/ao-thun-cotton');

      const compareRes = await agent.invoke('session-compare', 'so sánh 2 áo');
      expect(compareRes.message).toContain('199.000đ');
      expect(compareRes.message).toContain('299.000đ');

      detailsSpy.mockRestore();
      compareSpy.mockRestore();
    });

    it('retrieveProducts omits raw sentence keyword on price-range query and forwards filters to hybrid fallback', async () => {
      const chatbotService = require('../../src/services/chatbot.service');
      const embeddingService = require('../../src/services/embedding.service');

      const advSpy = vi
        .spyOn(toolHandlers, 'search_products_advanced')
        .mockResolvedValueOnce([{ id: 'p-1', name: 'Áo thun', price: 199000 }])
        .mockResolvedValueOnce([]);
      const hybridSpy = vi.spyOn(embeddingService, 'searchHybridProducts').mockResolvedValue({
        items: [{ id: 'p-2', name: 'Áo thun nam', price: 249000 }],
        strategy: 'hybrid',
      });

      const first = await chatbotService.retrieveProducts('Tìm áo thun nam dưới 300k');
      expect(first).toHaveLength(1);
      expect(advSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          keyword: undefined,
          maxPrice: 300000,
        }),
      );

      const second = await chatbotService.retrieveProducts('Tìm áo thun nam dưới 300k');
      expect(second).toHaveLength(1);
      expect(hybridSpy).toHaveBeenCalledWith(
        'Tìm áo thun nam dưới 300k',
        expect.objectContaining({
          filter: expect.objectContaining({
            maxPrice: 300000,
          }),
        }),
      );

      advSpy.mockRestore();
      hybridSpy.mockRestore();
    });
  });

  describe('addToCartValidator', () => {
    it('accepts chatbot quick-buy payloads without shopId or with empty shopId', () => {
      const validOmitted = addToCartValidator.validate({
        productId: '507f1f77bcf86cd799439011',
        quantity: 2,
        size: 'M',
      });
      expect(validOmitted.error).toBeUndefined();

      const validEmptyShop = addToCartValidator.validate({
        productId: '507f1f77bcf86cd799439011',
        shopId: '',
        quantity: 1,
      });
      expect(validEmptyShop.error).toBeUndefined();
    });

    describe('ChatbotService model initialization', () => {
      it('does not require the Mistral key until the model is used', () => {
        const originalKey = process.env.MISTRAL_API_KEY;
        const servicePath = require.resolve('../../src/services/chatbot.service');
        delete process.env.MISTRAL_API_KEY;
        delete require.cache[servicePath];

        try {
          const chatbotService = require('../../src/services/chatbot.service');
          expect(chatbotService.model).toBeNull();
          expect(() => chatbotService._ensureModel()).toThrow('MISTRAL_API_KEY is required');
        } finally {
          if (originalKey === undefined) {
            delete process.env.MISTRAL_API_KEY;
          } else {
            process.env.MISTRAL_API_KEY = originalKey;
          }
          delete require.cache[servicePath];
        }
      });
    });
  });

  describe('ChatbotController.feedback & auth integration', () => {
    it('passes authenticated req.user._id to chatbotService.saveFeedback', async () => {
      process.env.CHAT_SESSION_SECRET = 'test-secret-for-p0';
      const ChatbotController = require('../../src/controllers/chatbot.controller');
      const chatbotService = require('../../src/services/chatbot.service');

      const saveSpy = vi.spyOn(chatbotService, 'saveFeedback').mockResolvedValue({ success: true });

      const req = {
        cookies: {
          [COOKIE_NAME]: signChatSession('sess-123'),
        },
        body: {
          sessionId: 'sess-123',
          messageId: 'msg-456',
          rating: 'up',
          comment: 'Rất tốt',
        },
        user: { _id: 'user-789' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await ChatbotController.feedback(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledWith(
        'sess-123',
        'msg-456',
        'up',
        'Rất tốt',
        'user-789',
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'Feedback saved',
        }),
      );

      saveSpy.mockRestore();
    });

    it('passes null user ID when req.user is absent', async () => {
      process.env.CHAT_SESSION_SECRET = 'test-secret-for-p0';
      const ChatbotController = require('../../src/controllers/chatbot.controller');
      const chatbotService = require('../../src/services/chatbot.service');

      const saveSpy = vi.spyOn(chatbotService, 'saveFeedback').mockResolvedValue({ success: true });

      const req = {
        cookies: {
          [COOKIE_NAME]: signChatSession('sess-123'),
        },
        body: {
          sessionId: 'sess-123',
          messageId: 'msg-456',
          rating: 'down',
        },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await ChatbotController.feedback(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledWith(
        'sess-123',
        'msg-456',
        'down',
        undefined,
        null,
      );

      saveSpy.mockRestore();
    });
  });
});
