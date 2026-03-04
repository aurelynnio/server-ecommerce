/**
 * Unit Tests: Recommendation Service Logic
 * Tests co-occurrence counting, price range calculation, recently viewed tracking,
 * and recommendation filling strategy
 */
import { describe, it, expect } from 'vitest';

describe('RecommendationService Logic', () => {
  // --- Co-occurrence counting from orders ---
  describe('buildCoOccurrenceMap', () => {
    const buildCoOccurrenceMap = (orders, targetProductIds) => {
      const coOccurrence = {};
      const targetSet = new Set(targetProductIds.map(String));

      orders.forEach((order) => {
        const productIds = order.items.map((item) => item.product.toString());
        const hasTarget = productIds.some((id) => targetSet.has(id));
        if (!hasTarget) return;

        productIds.forEach((id) => {
          if (!targetSet.has(id)) {
            coOccurrence[id] = (coOccurrence[id] || 0) + 1;
          }
        });
      });

      return coOccurrence;
    };

    it('should count co-occurrences of non-target products', () => {
      const orders = [
        { items: [{ product: 'p1' }, { product: 'p2' }, { product: 'p3' }] },
        { items: [{ product: 'p1' }, { product: 'p3' }] },
      ];
      const result = buildCoOccurrenceMap(orders, ['p1']);
      expect(result.p2).toBe(1);
      expect(result.p3).toBe(2);
      expect(result.p1).toBeUndefined();
    });

    it('should skip orders without target products', () => {
      const orders = [{ items: [{ product: 'p2' }, { product: 'p3' }] }];
      const result = buildCoOccurrenceMap(orders, ['p1']);
      expect(result).toEqual({});
    });

    it('should handle empty orders', () => {
      const result = buildCoOccurrenceMap([], ['p1']);
      expect(result).toEqual({});
    });

    it('should handle multiple target products', () => {
      const orders = [
        { items: [{ product: 'p1' }, { product: 'p4' }] },
        { items: [{ product: 'p2' }, { product: 'p4' }] },
        { items: [{ product: 'p3' }, { product: 'p5' }] },
      ];
      const result = buildCoOccurrenceMap(orders, ['p1', 'p2']);
      expect(result.p4).toBe(2);
      expect(result.p5).toBeUndefined();
    });
  });

  // --- Sort co-occurrences by frequency ---
  describe('sortByFrequency', () => {
    const sortByFrequency = (coOccurrence) => {
      return Object.entries(coOccurrence)
        .sort(([, a], [, b]) => b - a)
        .map(([id]) => id);
    };

    it('should sort by frequency descending', () => {
      const result = sortByFrequency({ p2: 5, p3: 10, p4: 1 });
      expect(result).toEqual(['p3', 'p2', 'p4']);
    });

    it('should handle single entry', () => {
      const result = sortByFrequency({ p1: 3 });
      expect(result).toEqual(['p1']);
    });

    it('should handle empty map', () => {
      const result = sortByFrequency({});
      expect(result).toEqual([]);
    });
  });

  // --- Exclude already purchased/wishlisted ---
  describe('excludeProducts', () => {
    const excludeProducts = (productIds, purchasedIds, wishlistedIds) => {
      const excludeSet = new Set([...purchasedIds.map(String), ...wishlistedIds.map(String)]);
      return productIds.filter((id) => !excludeSet.has(String(id)));
    };

    it('should exclude purchased products', () => {
      const result = excludeProducts(['p1', 'p2', 'p3'], ['p1'], []);
      expect(result).toEqual(['p2', 'p3']);
    });

    it('should exclude wishlisted products', () => {
      const result = excludeProducts(['p1', 'p2', 'p3'], [], ['p2']);
      expect(result).toEqual(['p1', 'p3']);
    });

    it('should exclude both purchased and wishlisted', () => {
      const result = excludeProducts(['p1', 'p2', 'p3', 'p4'], ['p1'], ['p3']);
      expect(result).toEqual(['p2', 'p4']);
    });

    it('should return all if nothing to exclude', () => {
      const result = excludeProducts(['p1', 'p2'], [], []);
      expect(result).toEqual(['p1', 'p2']);
    });

    it('should return empty if all excluded', () => {
      const result = excludeProducts(['p1'], ['p1'], []);
      expect(result).toEqual([]);
    });
  });

  // --- Fill shortfall with popular products ---
  describe('fillWithPopular', () => {
    const fillWithPopular = (recommendations, popularProducts, limit, excludeIds) => {
      if (recommendations.length >= limit) {
        return recommendations.slice(0, limit);
      }

      const recSet = new Set(recommendations.map(String));
      const excludeSet = new Set(excludeIds.map(String));
      const filled = [...recommendations];

      for (const product of popularProducts) {
        if (filled.length >= limit) break;
        const id = String(product);
        if (!recSet.has(id) && !excludeSet.has(id)) {
          filled.push(product);
          recSet.add(id);
        }
      }

      return filled;
    };

    it('should not fill when already at limit', () => {
      const result = fillWithPopular(['p1', 'p2'], ['p3'], 2, []);
      expect(result).toEqual(['p1', 'p2']);
    });

    it('should fill shortfall with popular products', () => {
      const result = fillWithPopular(['p1'], ['p2', 'p3', 'p4'], 3, []);
      expect(result).toEqual(['p1', 'p2', 'p3']);
    });

    it('should not add duplicates from popular', () => {
      const result = fillWithPopular(['p1'], ['p1', 'p2', 'p3'], 3, []);
      expect(result).toEqual(['p1', 'p2', 'p3']);
    });

    it('should skip excluded products from popular', () => {
      const result = fillWithPopular(['p1'], ['p2', 'p3', 'p4'], 3, ['p2']);
      expect(result).toEqual(['p1', 'p3', 'p4']);
    });

    it('should handle empty recommendations', () => {
      const result = fillWithPopular([], ['p1', 'p2'], 2, []);
      expect(result).toEqual(['p1', 'p2']);
    });
  });

  // --- Similar products: 30% price range ---
  describe('priceRange', () => {
    const calculatePriceRange = (currentPrice) => {
      const priceRange = 0.3;
      return {
        min: currentPrice * (1 - priceRange),
        max: currentPrice * (1 + priceRange),
      };
    };

    it('should calculate 30% range for 100000', () => {
      const { min, max } = calculatePriceRange(100000);
      expect(min).toBe(70000);
      expect(max).toBe(130000);
    });

    it('should calculate 30% range for 500000', () => {
      const { min, max } = calculatePriceRange(500000);
      expect(min).toBe(350000);
      expect(max).toBe(650000);
    });

    it('should handle zero price', () => {
      const { min, max } = calculatePriceRange(0);
      expect(min).toBe(0);
      expect(max).toBe(0);
    });

    it('should handle very small price', () => {
      const { min, max } = calculatePriceRange(10);
      expect(min).toBe(7);
      expect(max).toBe(13);
    });
  });

  // --- trackProductView: dedup + limit ---
  describe('trackProductView', () => {
    const trackView = (viewedIds, productId) => {
      let result = viewedIds.filter((id) => id !== productId);
      result.unshift(productId);
      result = result.slice(0, 50);
      return result;
    };

    it('should add product to front', () => {
      const result = trackView(['p2', 'p3'], 'p1');
      expect(result[0]).toBe('p1');
      expect(result).toEqual(['p1', 'p2', 'p3']);
    });

    it('should move existing product to front', () => {
      const result = trackView(['p1', 'p2', 'p3'], 'p2');
      expect(result).toEqual(['p2', 'p1', 'p3']);
    });

    it('should not duplicate', () => {
      const result = trackView(['p1', 'p2'], 'p1');
      expect(result).toEqual(['p1', 'p2']);
    });

    it('should limit to 50 items', () => {
      const existing = Array.from({ length: 50 }, (_, i) => `p${i}`);
      const result = trackView(existing, 'pNew');
      expect(result).toHaveLength(50);
      expect(result[0]).toBe('pNew');
      expect(result[49]).toBe('p48'); // p49 was pushed out
    });

    it('should handle empty list', () => {
      const result = trackView([], 'p1');
      expect(result).toEqual(['p1']);
    });
  });
});
