/**
 * Integration Tests: Error Handling Pipeline
 * Tests error flow from controller through middleware to response
 */
import { describe, it, expect, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';

const catchAsync = require('../../src/configs/catchAsync');
const {
  ApiError,
  errorHandler,
  notFoundHandler,
} = require('../../src/middlewares/errorHandler.middleware');
const { sendSuccess, sendFail } = require('../../src/shared/res/formatResponse');

describe('Error Handling Pipeline - Integration Tests', () => {
  const createMockRes = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      headersSent: false,
    };
    return res;
  };

  describe('catchAsync -> errorHandler flow', () => {
    it('should catch ApiError and produce correct response', async () => {
      const handler = catchAsync(async (req, res) => {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
      });

      const req = {};
      const res = createMockRes();
      const errors = [];

      // Capture the error passed to next
      const next = (err) => {
        errors.push(err);
      };

      await handler(req, res, next);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(ApiError);
      expect(errors[0].statusCode).toBe(404);
      expect(errors[0].message).toBe('Product not found');

      // Now pass to errorHandler
      const errorRes = createMockRes();
      errorHandler(errors[0], req, errorRes, vi.fn());

      expect(errorRes.status).toHaveBeenCalledWith(404);
      expect(errorRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: 'Product not found',
        }),
      );
    });

    it('should handle ValidationError from Mongoose', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      validationError.errors = {
        name: { message: 'Name is required' },
        price: { message: 'Price must be positive' },
      };

      const handler = catchAsync(async () => {
        throw validationError;
      });

      const errors = [];
      await handler({}, createMockRes(), (err) => errors.push(err));

      const res = createMockRes();
      errorHandler(errors[0], {}, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.message).toContain('Name is required');
      expect(responseBody.message).toContain('Price must be positive');
    });

    it('should handle duplicate key MongoDB error', async () => {
      const dupError = new Error('duplicate key');
      dupError.code = 11000;
      dupError.keyValue = { email: 'test@test.com' };

      const res = createMockRes();
      errorHandler(dupError, {}, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.message).toContain('email already exists');
    });

    it('should handle JWT errors', async () => {
      const jwtError = new Error('jwt malformed');
      jwtError.name = 'JsonWebTokenError';

      const res = createMockRes();
      errorHandler(jwtError, {}, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.message).toContain('Invalid token');
    });
  });

  describe('notFoundHandler', () => {
    it('should create 404 ApiError for unknown routes', () => {
      const req = { originalUrl: '/api/nonexistent' };
      const next = vi.fn();

      notFoundHandler(req, {}, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('/api/nonexistent');
    });
  });

  describe('Controller -> Service -> Error Response', () => {
    it('should produce correct response for service throwing 409', async () => {
      // Simulate a service that throws conflict
      const mockService = {
        register: async (data) => {
          throw new ApiError(StatusCodes.CONFLICT, 'Email already in use');
        },
      };

      const controller = catchAsync(async (req, res) => {
        const result = await mockService.register(req.body);
        return sendSuccess(res, result, 'Registered', 201);
      });

      const req = { body: { email: 'existing@test.com', password: '123456' } };
      const res = createMockRes();
      const errors = [];

      controller(req, res, (err) => errors.push(err));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(errors).toHaveLength(1);

      const errorRes = createMockRes();
      errorHandler(errors[0], req, errorRes, vi.fn());

      expect(errorRes.status).toHaveBeenCalledWith(409);
      expect(errorRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: 'Email already in use',
        }),
      );
    });

    it('should produce correct response for service throwing 401', async () => {
      const mockService = {
        login: async () => {
          throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
        },
      };

      const controller = catchAsync(async (req, res) => {
        const result = await mockService.login(req.body.email, req.body.password);
        return sendSuccess(res, result, 'Login successful');
      });

      const errors = [];
      controller({ body: { email: 'wrong@test.com', password: 'wrong' } }, createMockRes(), (err) =>
        errors.push(err),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      const errorRes = createMockRes();
      errorHandler(errors[0], {}, errorRes, vi.fn());

      expect(errorRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Multiple Error Status Codes', () => {
    const testCases = [
      { code: 400, message: 'Bad Request', status: 'fail' },
      { code: 401, message: 'Unauthorized', status: 'fail' },
      { code: 403, message: 'Forbidden', status: 'fail' },
      { code: 404, message: 'Not Found', status: 'fail' },
      { code: 409, message: 'Conflict', status: 'fail' },
      { code: 500, message: 'Internal Error', status: 'error' },
    ];

    testCases.forEach(({ code, message, status }) => {
      it(`should handle ${code} ${message}`, () => {
        const error = new ApiError(code, message);
        const res = createMockRes();

        errorHandler(error, {}, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(code);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status, message }));
      });
    });
  });
});
