import { describe, it, expect } from 'vitest';
const {
  createLiteralRegex,
  normalizeSearchTerm,
  isValidObjectId,
  toFiniteNumber,
  buildMonthlyChartData,
} = require('../../src/utils/query.utils');

describe('Query Utils Suite', () => {
  describe('normalizeSearchTerm', () => {
    it('should trim and handle null/undefined', () => {
      expect(normalizeSearchTerm('  iphone 15  ')).toBe('iphone 15');
      expect(normalizeSearchTerm(null)).toBe('');
      expect(normalizeSearchTerm(undefined)).toBe('');
    });

    it('should truncate strings exceeding 200 characters', () => {
      const longStr = 'a'.repeat(300);
      expect(normalizeSearchTerm(longStr).length).toBe(200);
    });
  });

  describe('createLiteralRegex', () => {
    it('should create case-insensitive literal regex and escape special chars', () => {
      const regex = createLiteralRegex('iphone (15) [pro]+');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('Buy iPhone (15) [Pro]+ now')).toBe(true);
      expect(regex.test('iphone 15 pro')).toBe(false);
    });

    it('should return null for empty search terms', () => {
      expect(createLiteralRegex('')).toBeNull();
      expect(createLiteralRegex('   ')).toBeNull();
      expect(createLiteralRegex(null)).toBeNull();
    });

    it('should support exact and prefix matching modes', () => {
      const exactRegex = createLiteralRegex('test', { match: 'exact' });
      expect(exactRegex.test('test')).toBe(true);
      expect(exactRegex.test('testing')).toBe(false);

      const prefixRegex = createLiteralRegex('test', { match: 'prefix' });
      expect(prefixRegex.test('testing')).toBe(true);
      expect(prefixRegex.test('my test')).toBe(false);
    });
  });

  describe('isValidObjectId', () => {
    it('should return true for valid 24-character hexadecimal strings', () => {
      expect(isValidObjectId('65df8a76b91234567890abcd')).toBe(true);
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    });

    it('should return false for invalid strings, null, and non-hex characters', () => {
      expect(isValidObjectId('invalid-slug')).toBe(false);
      expect(isValidObjectId('123')).toBe(false);
      expect(isValidObjectId('65df8a76b91234567890abcg')).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
      expect(isValidObjectId({})).toBe(false);
    });
  });

  describe('toFiniteNumber', () => {
    it('should convert valid numbers and string numbers', () => {
      expect(toFiniteNumber(42)).toBe(42);
      expect(toFiniteNumber('42')).toBe(42);
      expect(toFiniteNumber('0')).toBe(0);
      expect(toFiniteNumber(-15.5)).toBe(-15.5);
    });

    it('should fallback for invalid numbers or NaN or Infinity', () => {
      expect(toFiniteNumber('abc')).toBeNull();
      expect(toFiniteNumber(NaN)).toBeNull();
      expect(toFiniteNumber(Infinity, 0)).toBe(0);
      expect(toFiniteNumber(undefined, 100)).toBe(100);
    });
  });

  describe('buildMonthlyChartData', () => {
    it('should construct continuous monthly data with zero fallbacks', () => {
      const referenceDate = new Date('2026-08-15T00:00:00Z');
      const mockRaw = [
        { _id: { month: 8, year: 2026 }, revenue: 5000000, orders: 12 },
        { _id: { month: 7, year: 2026 }, revenue: 3000000, orders: 8 },
      ];

      const chart = buildMonthlyChartData(mockRaw, 3, referenceDate);
      expect(chart).toHaveLength(3);
      expect(chart[0].month).toBe('T6');
      expect(chart[0].revenue).toBe(0);
      expect(chart[0].orders).toBe(0);

      expect(chart[1].month).toBe('T7');
      expect(chart[1].revenue).toBe(3000000);
      expect(chart[1].orders).toBe(8);

      expect(chart[2].month).toBe('T8');
      expect(chart[2].revenue).toBe(5000000);
      expect(chart[2].orders).toBe(12);
    });
  });
});

