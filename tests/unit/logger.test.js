/**
 * Unit Tests: Logger utility
 * Tests NDJSON structured output format, metadata serialization, and request correlation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
const logger = require('../../src/utils/logger');
const { runWithContext } = require('../../src/utils/asyncContext');

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger NDJSON output format', () => {
    it('error() should output valid JSON with level ERROR and message', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('something broke');
      expect(spy).toHaveBeenCalledOnce();
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe('ERROR');
      expect(parsed.message).toBe('something broke');
      expect(parsed.timestamp).toBeDefined();
    });

    it('warn() should output valid JSON with level WARN and message', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('low disk');
      expect(spy).toHaveBeenCalledOnce();
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe('WARN');
      expect(parsed.message).toBe('low disk');
    });

    it('info() should output valid JSON with level INFO and message', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('server started');
      expect(spy).toHaveBeenCalledOnce();
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('server started');
    });

    it('debug() should output valid JSON with level DEBUG and message', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('trace info');
      expect(spy).toHaveBeenCalledOnce();
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe('DEBUG');
      expect(parsed.message).toBe('trace info');
    });
  });

  describe('meta serialization in NDJSON', () => {
    it('should include meta object inside log payload', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('fail', { userId: 'abc', code: 500 });
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.meta).toEqual({ userId: 'abc', code: 500 });
    });

    it('should normalize Error objects inside meta', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('kaboom');
      logger.error('fail', { error: err });
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.meta.error.name).toBe('Error');
      expect(parsed.meta.error.message).toBe('kaboom');
    });

    it('should handle Error as meta directly', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new TypeError('type issue');
      logger.error('fail', err);
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.meta.name).toBe('TypeError');
      expect(parsed.meta.message).toBe('type issue');
    });

    it('should omit meta field when no meta is provided', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('no meta');
      const raw = spy.mock.calls[0][0];
      const parsed = JSON.parse(raw);
      expect(parsed.meta).toBeUndefined();
    });
  });

  describe('distributed tracing correlation ID', () => {
    it('should automatically inject requestId from AsyncLocalStorage context', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      runWithContext({ requestId: 'req-uuid-12345' }, () => {
        logger.info('operation within trace');
      });
      expect(spy).toHaveBeenCalledOnce();
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(parsed.requestId).toBe('req-uuid-12345');
      expect(parsed.message).toBe('operation within trace');
    });
  });

  describe('request logger', () => {
    it('should log request details in DEBUG level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const req = {
        method: 'GET',
        originalUrl: '/api/products',
        ip: '127.0.0.1',
        user: { userId: 'u123' },
      };
      logger.request(req, 'API call');
      expect(spy).toHaveBeenCalled();
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(parsed.level).toBe('DEBUG');
      expect(parsed.message).toBe('API call');
      expect(parsed.meta.method).toBe('GET');
      expect(parsed.meta.url).toBe('/api/products');
    });
  });

  describe('db logger', () => {
    it('should log DB operation in DEBUG level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.db('find', 'products', { filter: { status: 'active' } });
      expect(spy).toHaveBeenCalled();
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(parsed.level).toBe('DEBUG');
      expect(parsed.message).toBe('DB find on products');
      expect(parsed.meta.filter).toEqual({ status: 'active' });
    });
  });
});
