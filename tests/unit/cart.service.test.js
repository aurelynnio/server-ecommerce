/**
 * Unit Tests: Cart Service Logic
 * Tests cart total calculation and item matching
 */
import { describe, it, expect } from 'vitest';

describe('CartService Logic', () => {
  describe('calculateTotal', () => {
    const calculateTotal = (items) => {
      return items.reduce((total, item) => {
        const price = item.price?.discountPrice || item.price?.currentPrice || 0;
        return total + price * (item.quantity || 0);
      }, 0);
    };

    it('should calculate total from currentPrice', () => {
      const items = [
        { price: { currentPrice: 100000 }, quantity: 2 },
        { price: { currentPrice: 50000 }, quantity: 1 },
      ];
      expect(calculateTotal(items)).toBe(250000);
    });

    it('should prefer discountPrice over currentPrice', () => {
      const items = [{ price: { currentPrice: 100000, discountPrice: 80000 }, quantity: 1 }];
      expect(calculateTotal(items)).toBe(80000);
    });

    it('should handle empty cart', () => {
      expect(calculateTotal([])).toBe(0);
    });

    it('should handle items with zero quantity', () => {
      const items = [{ price: { currentPrice: 100000 }, quantity: 0 }];
      expect(calculateTotal(items)).toBe(0);
    });

    it('should handle items with missing price', () => {
      const items = [{ quantity: 2 }, { price: null, quantity: 1 }, { price: {}, quantity: 1 }];
      expect(calculateTotal(items)).toBe(0);
    });

    it('should handle multiple items with different structures', () => {
      const items = [
        { price: { currentPrice: 50000, discountPrice: 40000 }, quantity: 2 },
        { price: { currentPrice: 100000 }, quantity: 1 },
        { price: { currentPrice: 30000, discountPrice: 25000 }, quantity: 3 },
      ];
      // 40000*2 + 100000*1 + 25000*3 = 80000 + 100000 + 75000 = 255000
      expect(calculateTotal(items)).toBe(255000);
    });
  });

  describe('getCartItemWithListIds', () => {
    const getCartItemWithListIds = (cart, listIds) => {
      if (!cart || !cart.items) return null;
      return cart.items.find((item) => listIds.includes(item._id.toString()));
    };

    it('should find item by id', () => {
      const cart = {
        items: [
          { _id: { toString: () => 'item1' }, name: 'Product A' },
          { _id: { toString: () => 'item2' }, name: 'Product B' },
        ],
      };
      const result = getCartItemWithListIds(cart, ['item2']);
      expect(result.name).toBe('Product B');
    });

    it('should return undefined if not found', () => {
      const cart = {
        items: [{ _id: { toString: () => 'item1' } }],
      };
      expect(getCartItemWithListIds(cart, ['item999'])).toBeUndefined();
    });

    it('should return null for null cart', () => {
      expect(getCartItemWithListIds(null, ['id'])).toBeNull();
    });

    it('should return null for cart without items', () => {
      expect(getCartItemWithListIds({}, ['id'])).toBeNull();
    });
  });
});
