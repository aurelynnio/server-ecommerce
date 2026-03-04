/**
 * Integration Tests: Upload + ParseJSON Middleware Pipeline
 * Tests file upload validation → JSON field parsing → validate middleware chain
 */
import { describe, it, expect, vi } from 'vitest';

// We test the parseJsonFields middleware integration with validate
const parseJsonFields = require('../../src/middlewares/parseJsonFields.middleware');
const validate = require('../../src/middlewares/validate.middleware');
const { createProductValidator } = require('../../src/validations/product.validator');
const { sanitizeMiddleware } = require('../../src/validations/sanitize');

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

describe('Upload + ParseJSON + Validate Pipeline - Integration Tests', () => {
  describe('parseJsonFields → validate pipeline', () => {
    it('should parse JSON price field then validate product', async () => {
      const chain = [parseJsonFields(['price']), validate(createProductValidator)];

      const req = {
        body: {
          name: 'Test Product Name',
          description: 'A valid product description here',
          category: '507f1f77bcf86cd799439011',
          price: JSON.stringify({ currentPrice: 250000 }),
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.price).toEqual({
        currentPrice: 250000,
        currency: 'VND',
      });
      expect(finalReq.body.status).toBe('published');
    });

    it('should parse JSON variants + price then validate', async () => {
      const chain = [parseJsonFields(['price', 'variants']), validate(createProductValidator)];

      const req = {
        body: {
          name: 'Product With Variants',
          description: 'Description for product with multiple variants',
          category: '507f1f77bcf86cd799439011',
          price: JSON.stringify({ currentPrice: 300000 }),
          variants: JSON.stringify([{ name: 'Red L', price: 300000, stock: 10 }]),
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.price.currentPrice).toBe(300000);
      expect(finalReq.body.variants).toHaveLength(1);
      expect(finalReq.body.variants[0].name).toBe('Red L');
    });

    it('should reject invalid JSON in price field', async () => {
      const chain = [parseJsonFields(['price']), validate(createProductValidator)];

      const req = {
        body: {
          name: 'Test Product',
          description: 'Valid description here',
          category: '507f1f77bcf86cd799439011',
          price: '{invalid json',
        },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });
  });

  describe('sanitize → parseJsonFields → validate full pipeline', () => {
    it('should strip $ keys, parse JSON, then validate', async () => {
      const chain = [
        sanitizeMiddleware,
        parseJsonFields(['price']),
        validate(createProductValidator),
      ];

      const req = {
        body: {
          name: '  Clean Product  ',
          description: 'Description of the clean product test',
          category: '507f1f77bcf86cd799439011',
          price: JSON.stringify({ currentPrice: 100000 }),
          $inject: 'malicious',
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.name).toBe('Clean Product');
      expect(finalReq.body.$inject).toBeUndefined();
      expect(finalReq.body.price.currentPrice).toBe(100000);
    });

    it('should handle multipart-like request with file + JSON fields', async () => {
      const chain = [
        parseJsonFields(['price', 'attributes']),
        sanitizeMiddleware,
        validate(createProductValidator),
      ];

      const req = {
        body: {
          name: 'Product with Image',
          description: 'This product has images uploaded alongside',
          category: '507f1f77bcf86cd799439011',
          price: JSON.stringify({
            currentPrice: 500000,
            discountPrice: 400000,
          }),
          attributes: JSON.stringify([{ name: 'Material', value: 'Cotton' }]),
        },
        query: {},
        params: {},
        files: [{ filename: 'test.jpg', size: 1024 }],
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.price.discountPrice).toBe(400000);
      expect(finalReq.body.attributes[0].name).toBe('Material');
    });
  });

  describe('Edge cases in pipeline', () => {
    it('should handle body with non-string fields (skip parseJsonFields)', async () => {
      const chain = [parseJsonFields(['price']), validate(createProductValidator)];

      const req = {
        body: {
          name: 'Already Parsed',
          description: 'Price is already an object, not JSON string',
          category: '507f1f77bcf86cd799439011',
          price: { currentPrice: 200000 }, // already an object
        },
        query: {},
        params: {},
      };

      const { req: finalReq } = await runMiddlewareChain(chain, req);
      expect(finalReq.body.price.currentPrice).toBe(200000);
    });

    it('should reject after sanitize strips required fields', async () => {
      const chain = [sanitizeMiddleware, validate(createProductValidator)];

      // All keys start with $, so sanitizeMiddleware strips everything
      const req = {
        body: {
          $name: 'Hacked',
          $description: 'Injection',
          $category: '507f1f77bcf86cd799439011',
        },
        query: {},
        params: {},
      };

      await expect(runMiddlewareChain(chain, req)).rejects.toThrow();
    });
  });
});
