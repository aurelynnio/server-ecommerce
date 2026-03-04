/**
 * Unit Tests: parseJsonFields Middleware
 * Tests JSON parsing of multipart form-data string fields
 */
import { describe, it, expect, vi } from 'vitest';

const parseJsonFields = require('../../src/middlewares/parseJsonFields.middleware');

describe('parseJsonFields Middleware', () => {
  const createReq = (body) => ({ body });
  const res = {};

  it('should parse valid JSON string fields', () => {
    const req = createReq({
      price: '{"currentPrice": 100000, "discountPrice": 80000}',
      name: 'Test Product',
    });
    const next = vi.fn();

    parseJsonFields(['price'])(req, res, next);

    expect(req.body.price).toEqual({
      currentPrice: 100000,
      discountPrice: 80000,
    });
    expect(req.body.name).toBe('Test Product');
    expect(next).toHaveBeenCalled();
  });

  it('should parse multiple fields', () => {
    const req = createReq({
      price: '{"currentPrice": 50000}',
      variants: '[{"name": "Red", "stock": 10}]',
    });
    const next = vi.fn();

    parseJsonFields(['price', 'variants'])(req, res, next);

    expect(req.body.price).toEqual({ currentPrice: 50000 });
    expect(req.body.variants).toEqual([{ name: 'Red', stock: 10 }]);
    expect(next).toHaveBeenCalled();
  });

  it('should throw ApiError for invalid JSON', () => {
    const req = createReq({
      price: 'not valid json{',
    });

    expect(() => {
      parseJsonFields(['price'])(req, res, vi.fn());
    }).toThrow(/Invalid JSON format for field 'price'/);
  });

  it('should collect multiple parse errors', () => {
    const req = createReq({
      price: '{bad}',
      variants: '[bad]',
    });

    expect(() => {
      parseJsonFields(['price', 'variants'])(req, res, vi.fn());
    }).toThrow(/price.*variants|variants.*price/);
  });

  it('should skip non-string fields', () => {
    const req = createReq({
      price: { currentPrice: 100000 },
    });
    const next = vi.fn();

    parseJsonFields(['price'])(req, res, next);

    expect(req.body.price).toEqual({ currentPrice: 100000 });
    expect(next).toHaveBeenCalled();
  });

  it('should skip missing fields', () => {
    const req = createReq({ name: 'Test' });
    const next = vi.fn();

    parseJsonFields(['price'])(req, res, next);

    expect(req.body).toEqual({ name: 'Test' });
    expect(next).toHaveBeenCalled();
  });

  it('should call next when no body', () => {
    const req = {};
    const next = vi.fn();

    parseJsonFields(['price'])(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should handle empty fields array', () => {
    const req = createReq({ name: 'Test' });
    const next = vi.fn();

    parseJsonFields([])(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
