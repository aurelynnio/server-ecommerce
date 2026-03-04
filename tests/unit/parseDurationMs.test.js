/**
 * Unit Tests: parseDurationMs Utility
 * Tests duration string parsing to milliseconds
 */
import { describe, it, expect } from 'vitest';

const parseDurationMs = require('../../src/utils/parseDurationMs');

describe('parseDurationMs', () => {
  describe('valid duration strings', () => {
    it('should parse milliseconds', () => {
      expect(parseDurationMs('500ms')).toBe(500);
      expect(parseDurationMs('0ms')).toBe(0);
    });

    it('should parse seconds', () => {
      expect(parseDurationMs('30s')).toBe(30 * 1000);
      expect(parseDurationMs('1s')).toBe(1000);
    });

    it('should parse minutes', () => {
      expect(parseDurationMs('30m')).toBe(30 * 60 * 1000);
      expect(parseDurationMs('1m')).toBe(60 * 1000);
    });

    it('should parse hours', () => {
      expect(parseDurationMs('1h')).toBe(60 * 60 * 1000);
      expect(parseDurationMs('24h')).toBe(24 * 60 * 60 * 1000);
    });

    it('should parse days', () => {
      expect(parseDurationMs('1d')).toBe(24 * 60 * 60 * 1000);
      expect(parseDurationMs('16d')).toBe(16 * 24 * 60 * 60 * 1000);
    });

    it('should be case-insensitive', () => {
      expect(parseDurationMs('30M')).toBe(30 * 60 * 1000);
      expect(parseDurationMs('1H')).toBe(60 * 60 * 1000);
      expect(parseDurationMs('1D')).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('numeric input', () => {
    it('should return finite numbers as-is', () => {
      expect(parseDurationMs(5000)).toBe(5000);
      expect(parseDurationMs(0)).toBe(0);
    });

    it('should return fallback for non-finite numbers', () => {
      expect(parseDurationMs(Infinity, 1000)).toBe(1000);
      expect(parseDurationMs(NaN, 2000)).toBe(2000);
    });
  });

  describe('invalid input', () => {
    it('should return fallback for null/undefined', () => {
      expect(parseDurationMs(null, 1000)).toBe(1000);
      expect(parseDurationMs(undefined, 2000)).toBe(2000);
      expect(parseDurationMs('', 3000)).toBe(3000);
    });

    it('should return fallback for invalid format', () => {
      expect(parseDurationMs('abc', 100)).toBe(100);
      expect(parseDurationMs('30x', 100)).toBe(100);
      expect(parseDurationMs('m30', 100)).toBe(100);
    });

    it('should return null fallback by default', () => {
      expect(parseDurationMs(null)).toBe(null);
      expect(parseDurationMs('invalid')).toBe(null);
    });
  });
});
