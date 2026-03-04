/**
 * Unit Tests: Validate Middleware
 * Tests Joi schema validation middleware
 */
import { describe, it, expect, vi } from 'vitest';
import Joi from 'joi';

const validate = require('../../src/middlewares/validate.middleware');

describe('Validate Middleware', () => {
  const createMockReqRes = (body = {}, params = {}, query = {}) => {
    const req = { body, params, query };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  describe('Body Validation', () => {
    const schema = {
      body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
      }),
    };

    it('should call next for valid body', () => {
      const { req, res, next } = createMockReqRes({
        email: 'test@test.com',
        password: 'password123',
      });

      validate(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should throw ApiError for invalid body', () => {
      const { req, res, next } = createMockReqRes({
        email: 'not-an-email',
        password: '123',
      });

      expect(() => validate(schema)(req, res, next)).toThrow();
    });

    it('should throw for missing required fields', () => {
      const { req, res, next } = createMockReqRes({});

      expect(() => validate(schema)(req, res, next)).toThrow();
    });
  });

  describe('Params Validation', () => {
    const schema = {
      params: Joi.object({
        id: Joi.string().required(),
      }),
    };

    it('should validate params', () => {
      const { req, res, next } = createMockReqRes({}, { id: '507f1f77bcf86cd799439011' });

      validate(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should throw for missing params', () => {
      const { req, res, next } = createMockReqRes({}, {});

      expect(() => validate(schema)(req, res, next)).toThrow();
    });
  });

  describe('Query Validation', () => {
    const schema = {
      query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
      }),
    };

    it('should apply defaults for missing query params', () => {
      const { req, res, next } = createMockReqRes({}, {}, {});

      validate(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.query.page).toBe(1);
      expect(req.query.limit).toBe(10);
    });

    it('should accept valid query params', () => {
      const { req, res, next } = createMockReqRes({}, {}, { page: 3, limit: 20 });

      validate(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Single Schema (body-only shorthand)', () => {
    const schema = Joi.object({
      name: Joi.string().required(),
    });

    it('should validate body when passed a single Joi schema', () => {
      const { req, res, next } = createMockReqRes({ name: 'Test' });

      validate(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should throw for invalid body with single schema', () => {
      const { req, res, next } = createMockReqRes({});

      expect(() => validate(schema)(req, res, next)).toThrow();
    });
  });

  describe('Strip Unknown Fields', () => {
    const schema = {
      body: Joi.object({
        email: Joi.string().email().required(),
      }),
    };

    it('should strip unknown fields from request', () => {
      const { req, res, next } = createMockReqRes({
        email: 'test@test.com',
        maliciousField: 'hack',
        __proto__: 'pollution',
      });

      validate(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.maliciousField).toBeUndefined();
    });
  });
});
