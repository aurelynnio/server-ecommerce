/**
 * Integration Tests: Sanitize + Validate Pipeline
 * Tests the full flow: sanitizeMiddleware → validate(schema) → handler
 */
import { describe, it, expect, vi } from 'vitest';

const validate = require('../../src/middlewares/validate.middleware');
const { sanitizeMiddleware } = require('../../src/validations/sanitize');
const {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
} = require('../../src/validations/auth.validator');
const {
  createProductValidator,
  searchQueryValidator,
} = require('../../src/validations/product.validator');
const { addToCartValidator } = require('../../src/validations/cart.validator');
const { createReviewValidator } = require('../../src/validations/review.validator');
const { createOrderValidator } = require('../../src/validations/order.validator');

/**
 * Helper: run middleware chain sequentially
 */
function runMiddlewareChain(middlewares, req) {
  return new Promise((resolve, reject) => {
    let idx = 0;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    function next(err) {
      if (err) return reject(err);
      const mw = middlewares[idx++];
      if (!mw) return resolve({ req, res });
      try {
        mw(req, res, next);
      } catch (e) {
        reject(e);
      }
    }

    next();
  });
}

describe('Sanitize + Validate Pipeline - Integration Tests', () => {
  describe('Auth Registration Pipeline', () => {
    const chain = [sanitizeMiddleware, validate(registerValidator)];

    it('should sanitize and validate valid registration data', async () => {
      const req = {
        body: {
          username: '  john_doe  ',
          email: '  JOHN@test.com  ',
          password: 'secret123',
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.username).toBe('john_doe');
      // sanitizedString trims but does not lowercase email
      expect(finalReq.body.email).toBe('JOHN@test.com');
    });

    it('should strip $ prefixed keys from body (NoSQL injection prevention)', async () => {
      const req = {
        body: {
          username: 'john',
          email: 'john@test.com',
          password: 'secret123',
          $gt: '1',
          $where: 'hack',
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      // sanitizeMiddleware removes $ keys
      expect(finalReq.body.$gt).toBeUndefined();
      expect(finalReq.body.$where).toBeUndefined();
      expect(finalReq.body.username).toBe('john');
    });

    it('should reject invalid email after sanitization', async () => {
      const req = {
        body: {
          username: 'john',
          email: 'not-email',
          password: 'secret123',
        },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });

    it('should reject short password after sanitization', async () => {
      const req = {
        body: {
          username: 'john',
          email: 'john@test.com',
          password: '12345',
        },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });
  });

  describe('Login Pipeline', () => {
    const chain = [sanitizeMiddleware, validate(loginValidator)];

    it('should pass valid login through full pipeline', async () => {
      const req = {
        body: { email: 'test@test.com', password: 'password123' },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.email).toBe('test@test.com');
    });

    it('should reject missing password', async () => {
      const req = {
        body: { email: 'test@test.com' },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });
  });

  describe('Verify Email Pipeline', () => {
    const chain = [sanitizeMiddleware, validate(verifyEmailValidator)];

    it('should sanitize and validate verification code', async () => {
      const req = {
        body: { email: '  test@test.com  ', code: ' 123456 ' },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.email).toBe('test@test.com');
      expect(finalReq.body.code).toBe('123456');
    });

    it('should reject non-numeric code', async () => {
      const req = {
        body: { email: 'test@test.com', code: 'abc123' },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });
  });

  describe('Product Creation Pipeline', () => {
    const chain = [sanitizeMiddleware, validate(createProductValidator)];

    it('should sanitize and validate valid product', async () => {
      const req = {
        body: {
          name: '  Áo khoác mùa đông  ',
          description: 'Áo khoác ấm cho mùa đông, chất liệu cao cấp',
          category: '507f1f77bcf86cd799439011',
          price: { currentPrice: 350000 },
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.name).toBe('Áo khoác mùa đông');
      expect(finalReq.body.status).toBe('published'); // default
    });

    it('should strip injection keys and still pass validation', async () => {
      const req = {
        body: {
          name: 'Valid Name Here',
          description: 'Valid description here folks',
          category: '507f1f77bcf86cd799439011',
          price: { currentPrice: 100000 },
          $set: { status: 'admin' }, // injection attempt
        },
        query: {},
        params: {},
      };

      // sanitizeMiddleware removes $set, validation passes
      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.$set).toBeUndefined();
      expect(finalReq.body.name).toBe('Valid Name Here');
    });

    it('should strip MongoDB operators from body before validation', async () => {
      const req = {
        body: {
          name: 'Valid Product Name',
          description: 'Valid description with enough chars',
          category: '507f1f77bcf86cd799439011',
          price: { currentPrice: 100000 },
          $set: { admin: true },
        },
        query: {},
        params: {},
      };

      const { req: result } = await runMiddlewareChain(chain, req);
      expect(result.body.$set).toBeUndefined();
      expect(result.body.name).toBe('Valid Product Name');
    });
  });

  describe('Search Query Pipeline', () => {
    const chain = [sanitizeMiddleware, validate({ query: searchQueryValidator })];

    it('should sanitize MongoDB operators from search query', async () => {
      const req = {
        body: {},
        query: { q: '$where.attack' },
        params: {},
      };

      // sanitizeMiddleware strips $ from query params via sanitizeObject
      const { req: finalReq } = await runMiddlewareChain(chain, req);
      // Both sanitizeMiddleware (strips $ keys) and searchString() (removes $ and .)
      expect(finalReq.query.q).not.toContain('$');
    });

    it('should reject empty search query', async () => {
      const req = {
        body: {},
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });

    it('should pass valid search query', async () => {
      const req = {
        body: {},
        query: { q: 'áo khoác' },
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.query.q).toBe('áo khoác');
    });
  });

  describe('Cart + Order Pipeline', () => {
    it('should validate cart item with sanitized body', async () => {
      const chain = [sanitizeMiddleware, validate(addToCartValidator)];
      const req = {
        body: {
          productId: '507f1f77bcf86cd799439011',
          quantity: 3,
          $gt: 'hack',
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.productId).toBe('507f1f77bcf86cd799439011');
      expect(finalReq.body.quantity).toBe(3);
      expect(finalReq.body.$gt).toBeUndefined();
    });

    it('should validate order with sanitized shipping address', async () => {
      const chain = [sanitizeMiddleware, validate(createOrderValidator)];
      const req = {
        body: {
          cartItemIds: ['507f1f77bcf86cd799439011'],
          shippingAddress: {
            fullName: '  Nguyễn Văn A  ',
            phone: '0901234567',
            address: '  123 Lê Lợi, Quận 1  ',
            city: '  TP.HCM  ',
          },
          paymentMethod: 'cod',
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.shippingAddress.fullName).toBe('Nguyễn Văn A');
      expect(finalReq.body.shippingAddress.address).toBe('123 Lê Lợi, Quận 1');
    });
  });

  describe('Review Pipeline (XSS prevention)', () => {
    const chain = [sanitizeMiddleware, validate(createReviewValidator)];

    it('should escape HTML in review comment', async () => {
      const req = {
        body: {
          productId: '507f1f77bcf86cd799439011',
          rating: 5,
          comment: '<script>alert("xss")</script>',
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.comment).not.toContain('<script>');
      expect(finalReq.body.comment).toContain('&lt;script&gt;');
      expect(finalReq.body.rating).toBe(5);
    });

    it('should reject rating out of range', async () => {
      const req = {
        body: {
          productId: '507f1f77bcf86cd799439011',
          rating: 6,
        },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });
  });
});
