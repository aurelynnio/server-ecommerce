/**
 * Unit Tests: Logger utility
 * Tests pure functions: normalizeError, normalizeMeta, formatMessage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Logger module uses dynamic `currentLevel` based on NODE_ENV
// We test the exported pure-logic helpers by re-implementing + verifying logger methods
const logger = require('../../src/utils/logger');

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* ---- normalizeError / normalizeMeta / formatMessage ----
   * These are module-private. We test them indirectly through logger methods
   * which call formatMessage → normalizeMeta → normalizeError internally.
   */

  describe('logger method output format', () => {
    it('error() should print [ERROR] with message', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('something broke');
      expect(spy).toHaveBeenCalledOnce();
      const output = spy.mock.calls[0][0];
      expect(output).toContain('[ERROR]');
      expect(output).toContain('something broke');
    });

    it('warn() should print [WARN] with message', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('low disk');
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain('[WARN]');
    });

    it('info() should print [INFO] with message', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('server started');
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain('[INFO]');
    });

    it('debug() should print [DEBUG] with message', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('trace info');
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain('[DEBUG]');
    });
  });

  describe('meta serialization', () => {
    it('should include meta as JSON when provided', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('fail', { userId: 'abc', code: 500 });
      const output = spy.mock.calls[0][0];
      expect(output).toContain('"userId":"abc"');
      expect(output).toContain('"code":500');
    });

    it('should normalize Error objects inside meta', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('kaboom');
      logger.error('fail', { error: err });
      const output = spy.mock.calls[0][0];
      // Error is serialized into { name, message, stack }
      expect(output).toContain('"name":"Error"');
      expect(output).toContain('"message":"kaboom"');
    });

    it('should handle Error as meta directly', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new TypeError('type issue');
      logger.error('fail', err);
      const output = spy.mock.calls[0][0];
      expect(output).toContain('"name":"TypeError"');
      expect(output).toContain('"message":"type issue"');
    });

    it('should handle non-object meta', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('fail', 'string-meta');
      const output = spy.mock.calls[0][0];
      expect(output).toContain('"meta":"string-meta"');
    });

    it('should return empty string for no meta', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('no meta');
      const output = spy.mock.calls[0][0];
      // Format: [timestamp] [ERROR] no meta  (no trailing JSON)
      expect(output).toMatch(/\[ERROR\] no meta$/);
    });
  });

  describe('timestamp format', () => {
    it('should include ISO timestamp', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('test');
      const output = spy.mock.calls[0][0];
      // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
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
      const output = spy.mock.calls[0][0];
      expect(output).toContain('[DEBUG]');
      expect(output).toContain('API call');
      expect(output).toContain('"method":"GET"');
    });

    it('should use default message when none provided', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.request({ method: 'POST', originalUrl: '/api/auth' });
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('Incoming request');
    });
  });

  describe('db logger', () => {
    it('should log DB operation in DEBUG level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.db('find', 'products', { filter: { status: 'active' } });
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(output).toContain('DB find on products');
    });
  });
});
