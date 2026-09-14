import { describe, it, expect } from 'vitest';
const {
  calculateVoucherDiscount,
  distributePlatformDiscount,
  resolveEffectiveItemPrice,
  requireFiniteNumber,
} = require('../../src/utils/discount.util');

describe('Discount Utility (discount.util)', () => {
  describe('requireFiniteNumber', () => {
    it('returns valid number', () => {
      expect(requireFiniteNumber(100)).toBe(100);
      expect(requireFiniteNumber('250')).toBe(250);
    });

    it('throws 422 for invalid number', () => {
      expect(() => requireFiniteNumber('invalid')).toThrow();
      expect(() => requireFiniteNumber(NaN)).toThrow();
      expect(() => requireFiniteNumber(Infinity)).toThrow();
    });
  });

  describe('calculateVoucherDiscount', () => {
    it('calculates fixed discount capped by order value', () => {
      const voucher = { type: 'fixed_amount', value: 30000 };
      expect(calculateVoucherDiscount(voucher, 100000)).toBe(30000);
      // Order value is less than discount
      expect(calculateVoucherDiscount(voucher, 20000)).toBe(20000);
    });

    it('calculates percentage discount accurately', () => {
      const voucher = { type: 'percentage', value: 10, maxValue: 50000 };
      expect(calculateVoucherDiscount(voucher, 200000)).toBe(20000);
      expect(calculateVoucherDiscount(voucher, 100000)).toBe(10000);
    });

    it('caps percentage discount at maxValue', () => {
      const voucher = { type: 'percentage', value: 20, maxValue: 50000 };
      // 20% of 500,000 is 100,000, capped at 50,000
      expect(calculateVoucherDiscount(voucher, 500000)).toBe(50000);
    });

    it('supports alternative keys (discountType, discountValue, maxDiscount)', () => {
      const voucher = { discountType: 'percentage', discountValue: 15, maxDiscount: 30000 };
      expect(calculateVoucherDiscount(voucher, 100000)).toBe(15000);
      expect(calculateVoucherDiscount(voucher, 500000)).toBe(30000);
    });

    it('returns 0 for null/undefined voucher', () => {
      expect(calculateVoucherDiscount(null, 100000)).toBe(0);
    });
  });

  describe('distributePlatformDiscount', () => {
    it('distributes platform discount proportionally and assigns remainder to last order', () => {
      const orders = [{ totalAmount: 200000 }, { totalAmount: 300000 }];
      const totalDiscount = 50000;
      const result = distributePlatformDiscount(orders, totalDiscount);

      // Order 1: 200k / 500k * 50k = 20k
      expect(result[0].discountPlatform).toBe(20000);
      expect(result[0].totalAmount).toBe(180000);

      // Order 2: remainder 50k - 20k = 30k
      expect(result[1].discountPlatform).toBe(30000);
      expect(result[1].totalAmount).toBe(270000);

      // Sum equals total platform discount
      expect(result[0].discountPlatform + result[1].discountPlatform).toBe(totalDiscount);
    });

    it('clamps totalAmount to 0 if discount exceeds order amount', () => {
      const orders = [{ totalAmount: 10000 }];
      const result = distributePlatformDiscount(orders, 50000);

      expect(result[0].discountPlatform).toBe(50000);
      expect(result[0].totalAmount).toBe(0);
    });

    it('handles zero order total gracefully', () => {
      const orders = [{ totalAmount: 0 }, { totalAmount: 0 }];
      const result = distributePlatformDiscount(orders, 50000);

      expect(result[0].discountPlatform).toBe(0);
      expect(result[0].totalAmount).toBe(0);
      expect(result[1].discountPlatform).toBe(0);
      expect(result[1].totalAmount).toBe(0);
    });
  });

  describe('resolveEffectiveItemPrice', () => {
    const mockProduct = {
      name: 'Wireless Mouse',
      price: { currentPrice: 150000 },
      variants: [
        { _id: 'var1', price: 180000, sku: 'WM-BLU' },
        { _id: 'var2', price: 200000, sku: 'WM-RED' },
      ],
      flashSale: null,
    };

    it('resolves base price when no variant is selected', () => {
      const res = resolveEffectiveItemPrice({ product: mockProduct });
      expect(res.price).toBe(150000);
      expect(res.isFlashSale).toBe(false);
      expect(res.flashSalePrice).toBe(null);
    });

    it('resolves variant price when variantId matches', () => {
      const res = resolveEffectiveItemPrice({ product: mockProduct, variantId: 'var1' });
      expect(res.price).toBe(180000);
      expect(res.skuCode).toBe('WM-BLU');
    });

    it('throws 404 when variantId does not exist', () => {
      expect(() =>
        resolveEffectiveItemPrice({ product: mockProduct, variantId: 'var999' }),
      ).toThrow();
    });

    it('overrides price with flash sale price when flash sale is active', () => {
      const now = new Date('2026-09-14T10:00:00Z');
      const flashProduct = {
        name: 'Flash Item',
        price: { currentPrice: 200000 },
        flashSale: {
          isActive: true,
          salePrice: 99000,
          stock: 10,
          soldCount: 2,
          startTime: new Date('2026-09-14T09:00:00Z'),
          endTime: new Date('2026-09-14T12:00:00Z'),
        },
      };

      const res = resolveEffectiveItemPrice({ product: flashProduct, now });
      expect(res.isFlashSale).toBe(true);
      expect(res.flashSalePrice).toBe(99000);
      expect(res.price).toBe(99000);
    });
  });
});
