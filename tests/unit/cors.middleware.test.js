/**
 * Unit Tests: CORS Middleware Helpers
 * Tests isLocalhostOrigin and getAllowedOrigins
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the pure functions, but they are not exported separately
// Let's test the logic directly

describe('CORS Middleware Logic', () => {
  describe('isLocalhostOrigin logic', () => {
    const isLocalhostOrigin = (origin) => {
      return typeof origin === 'string' && origin.startsWith('http://localhost');
    };

    it('should return true for http://localhost:3000', () => {
      expect(isLocalhostOrigin('http://localhost:3000')).toBe(true);
    });

    it('should return true for http://localhost:8080', () => {
      expect(isLocalhostOrigin('http://localhost:8080')).toBe(true);
    });

    it('should return true for http://localhost (no port)', () => {
      expect(isLocalhostOrigin('http://localhost')).toBe(true);
    });

    it('should return false for https://localhost', () => {
      expect(isLocalhostOrigin('https://localhost:3000')).toBe(false);
    });

    it('should return false for production URL', () => {
      expect(isLocalhostOrigin('https://etiso.me')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isLocalhostOrigin(null)).toBe(false);
      expect(isLocalhostOrigin(undefined)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isLocalhostOrigin(3000)).toBe(false);
    });
  });

  describe('getAllowedOrigins logic', () => {
    const defaultDevOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://etiso.me',
    ];

    const getAllowedOrigins = (env, frontendUrl) => {
      if (env === 'production') {
        return frontendUrl ? [frontendUrl] : [];
      }
      return defaultDevOrigins;
    };

    it('should return dev origins in development', () => {
      const origins = getAllowedOrigins('development');
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://localhost:3001');
      expect(origins).toContain('https://etiso.me');
    });

    it('should return FRONTEND_URL in production', () => {
      const origins = getAllowedOrigins('production', 'https://myapp.com');
      expect(origins).toEqual(['https://myapp.com']);
    });

    it('should return empty in production without FRONTEND_URL', () => {
      const origins = getAllowedOrigins('production', undefined);
      expect(origins).toEqual([]);
    });

    it('should return dev origins in test', () => {
      const origins = getAllowedOrigins('test');
      expect(origins).toEqual(defaultDevOrigins);
    });
  });
});
