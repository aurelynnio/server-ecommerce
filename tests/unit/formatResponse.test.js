/**
 * Unit Tests: Format Response Helpers
 * Tests sendSuccess, sendFail, sendJson
 */
import { describe, it, expect, vi } from 'vitest';

const {
  successResponse,
  failResponse,
  sendSuccess,
  sendFail,
  sendJson,
} = require('../../src/shared/res/formatResponse');

describe('Format Response', () => {
  describe('successResponse', () => {
    it('should return standard success object', () => {
      const result = successResponse({ id: 1 }, 'OK', 200);

      expect(result.status).toBe('success');
      expect(result.message).toBe('OK');
      expect(result.code).toBe(200);
      expect(result.data).toEqual({ id: 1 });
    });

    it('should allow custom status', () => {
      const result = successResponse(null, 'Created', 201, 'created');
      expect(result.status).toBe('created');
    });
  });

  describe('failResponse', () => {
    it('should return standard fail object', () => {
      const result = failResponse('Not found', 404);

      expect(result.status).toBe('fail');
      expect(result.message).toBe('Not found');
      expect(result.code).toBe(404);
      expect(result.data).toBeUndefined();
    });
  });

  describe('sendSuccess', () => {
    it('should set status code and send JSON', () => {
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      sendSuccess(res, { user: 'test' }, 'Success', 200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'Success',
          code: 200,
          data: { user: 'test' },
        }),
      );
    });

    it('should default to 200 status code', () => {
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      sendSuccess(res, null, 'OK');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('sendFail', () => {
    it('should set status code and send fail JSON', () => {
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      sendFail(res, 'Bad request', 400);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: 'Bad request',
          code: 400,
        }),
      );
    });
  });

  describe('sendJson', () => {
    it('should send raw JSON with status code', () => {
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      sendJson(res, { custom: 'data' }, 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ custom: 'data' });
    });

    it('should default to 200', () => {
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };

      sendJson(res, { ok: true });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
