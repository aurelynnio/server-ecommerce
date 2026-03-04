/**
 * Unit Tests: Error Handler Middleware
 * Tests ApiError, status code mapping, and error message formatting
 */
import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';

const {
  ApiError,
  getStatusCode,
  getErrorMessage,
} = require('../../src/middlewares/errorHandler.middleware');

describe('Error Handler', () => {
  describe('ApiError', () => {
    it('should create error with statusCode and message', () => {
      const error = new ApiError(StatusCodes.NOT_FOUND, 'Resource not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.isOperational).toBe(true);
      expect(error.status).toBe('fail');
    });

    it('should set status to "error" for 5xx codes', () => {
      const error = new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Server error');
      expect(error.status).toBe('error');
    });

    it('should set status to "fail" for 4xx codes', () => {
      const error = new ApiError(StatusCodes.BAD_REQUEST, 'Bad request');
      expect(error.status).toBe('fail');
    });

    it('should capture stack trace', () => {
      const error = new ApiError(400, 'test');
      expect(error.stack).toBeDefined();
    });

    it('should support isOperational flag', () => {
      const opError = new ApiError(500, 'operational', true);
      const nonOpError = new ApiError(500, 'non-operational', false);

      expect(opError.isOperational).toBe(true);
      expect(nonOpError.isOperational).toBe(false);
    });
  });

  describe('getStatusCode', () => {
    it('should return statusCode from ApiError', () => {
      const error = new ApiError(404, 'not found');
      expect(getStatusCode(error)).toBe(404);
    });

    it('should map ValidationError to 400', () => {
      const error = new Error('validation failed');
      error.name = 'ValidationError';
      expect(getStatusCode(error)).toBe(400);
    });

    it('should map CastError to 400', () => {
      const error = new Error('cast error');
      error.name = 'CastError';
      expect(getStatusCode(error)).toBe(400);
    });

    it('should map JsonWebTokenError to 401', () => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      expect(getStatusCode(error)).toBe(401);
    });

    it('should map TokenExpiredError to 401', () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      expect(getStatusCode(error)).toBe(401);
    });

    it('should map MongoDB duplicate key to 409', () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      expect(getStatusCode(error)).toBe(409);
    });

    it('should default to 500 for unknown errors', () => {
      const error = new Error('unknown error');
      expect(getStatusCode(error)).toBe(500);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from operational ApiError', () => {
      const error = new ApiError(400, 'Custom message');
      expect(getErrorMessage(error)).toBe('Custom message');
    });

    it('should format Mongoose ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.errors = {
        name: { message: 'Name is required' },
        email: { message: 'Email is invalid' },
      };
      const msg = getErrorMessage(error);
      expect(msg).toContain('Name is required');
      expect(msg).toContain('Email is invalid');
    });

    it('should format Joi ValidationError', () => {
      const error = new Error('validation');
      error.name = 'ValidationError';
      error.details = [
        { message: '"email" is required' },
        { message: '"password" length must be at least 6' },
      ];
      const msg = getErrorMessage(error);
      expect(msg).toContain('"email" is required');
      expect(msg).toContain('"password" length must be at least 6');
    });

    it('should format CastError', () => {
      const error = new Error('cast');
      error.name = 'CastError';
      error.path = '_id';
      error.value = 'invalid-id';
      expect(getErrorMessage(error)).toBe('Invalid _id: invalid-id');
    });

    it('should format MongoDB duplicate key error', () => {
      const error = new Error('duplicate');
      error.code = 11000;
      error.keyValue = { email: 'test@test.com' };
      expect(getErrorMessage(error)).toBe('email already exists');
    });

    it('should format JWT errors', () => {
      const jwtError = new Error('jwt malformed');
      jwtError.name = 'JsonWebTokenError';
      expect(getErrorMessage(jwtError)).toContain('Invalid token');

      const expError = new Error('jwt expired');
      expError.name = 'TokenExpiredError';
      expect(getErrorMessage(expError)).toContain('Token expired');
    });

    it('should format MulterError', () => {
      const error = new Error('file error');
      error.name = 'MulterError';
      error.code = 'LIMIT_FILE_SIZE';
      expect(getErrorMessage(error)).toBe('File too large');
    });
  });
});
