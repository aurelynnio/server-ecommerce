import { describe, it, expect } from 'vitest';
const {
  isFlashSaleTimeWindowActive,
  isFlashSaleActive,
  getProductFlashSale,
} = require('../../src/utils/flashSale.util');

describe('FlashSale Utility', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const past = new Date('2026-06-15T10:00:00.000Z');
  const future = new Date('2026-06-15T14:00:00.000Z');
  const farPast = new Date('2026-06-15T08:00:00.000Z');

  describe('isFlashSaleTimeWindowActive', () => {
    it('returns false for null / undefined or inactive flash sale', () => {
      expect(isFlashSaleTimeWindowActive(null, now)).toBe(false);
      expect(isFlashSaleTimeWindowActive(undefined, now)).toBe(false);
      expect(
        isFlashSaleTimeWindowActive({ isActive: false, startTime: past, endTime: future }, now),
      ).toBe(false);
    });

    it('returns true when current time is within start and end time', () => {
      expect(
        isFlashSaleTimeWindowActive({ isActive: true, startTime: past, endTime: future }, now),
      ).toBe(true);
    });

    it('returns false when flash sale has expired', () => {
      expect(
        isFlashSaleTimeWindowActive({ isActive: true, startTime: farPast, endTime: past }, now),
      ).toBe(false);
    });

    it('returns false when flash sale has not started yet', () => {
      expect(
        isFlashSaleTimeWindowActive(
          { isActive: true, startTime: future, endTime: new Date(future.getTime() + 3600000) },
          now,
        ),
      ).toBe(false);
    });
  });

  describe('isFlashSaleActive', () => {
    it('returns true when active, within time window, and quota available', () => {
      const flashSale = {
        isActive: true,
        startTime: past,
        endTime: future,
        stock: 50,
        soldCount: 10,
      };
      expect(isFlashSaleActive(flashSale, now)).toBe(true);
    });

    it('returns true when stock is not limited (0 or falsy)', () => {
      const flashSale = {
        isActive: true,
        startTime: past,
        endTime: future,
        stock: 0,
        soldCount: 100,
      };
      expect(isFlashSaleActive(flashSale, now)).toBe(true);
    });

    it('returns false when soldCount reaches or exceeds stock', () => {
      const flashSale = {
        isActive: true,
        startTime: past,
        endTime: future,
        stock: 50,
        soldCount: 50,
      };
      expect(isFlashSaleActive(flashSale, now)).toBe(false);
    });
  });

  describe('getProductFlashSale', () => {
    it('returns isFlashSale: true and salePrice when product is in active flash sale', () => {
      const product = {
        name: 'Sale item',
        flashSale: {
          isActive: true,
          startTime: past,
          endTime: future,
          salePrice: 199000,
          stock: 20,
          soldCount: 5,
        },
      };
      const result = getProductFlashSale(product, now);
      expect(result).toEqual({ isFlashSale: true, salePrice: 199000 });
    });

    it('returns isFlashSale: false and salePrice: null when flash sale is inactive or expired', () => {
      const product = {
        name: 'Regular item',
        flashSale: {
          isActive: false,
          salePrice: 199000,
        },
      };
      const result = getProductFlashSale(product, now);
      expect(result).toEqual({ isFlashSale: false, salePrice: null });
    });
  });
});
