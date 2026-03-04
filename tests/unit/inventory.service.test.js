/**
 * Unit Tests: InventoryService.aggregateItems()
 * Tests pure item aggregation logic (no DB)
 */
import { describe, it, expect } from 'vitest';

const inventoryService = require('../../src/services/inventory.service');

describe('InventoryService', () => {
  describe('aggregateItems()', () => {
    it('should return single item unchanged', () => {
      const items = [{ productId: 'p1', modelId: null, quantity: 3 }];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(3);
    });

    it('should aggregate same product+variant', () => {
      const items = [
        { productId: 'p1', modelId: 'v1', quantity: 2 },
        { productId: 'p1', modelId: 'v1', quantity: 3 },
      ];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(5);
      expect(result[0].productId).toBe('p1');
      expect(result[0].modelId).toBe('v1');
    });

    it('should keep different variants separate', () => {
      const items = [
        { productId: 'p1', modelId: 'v1', quantity: 1 },
        { productId: 'p1', modelId: 'v2', quantity: 2 },
      ];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(2);
    });

    it('should keep different products separate', () => {
      const items = [
        { productId: 'p1', modelId: null, quantity: 1 },
        { productId: 'p2', modelId: null, quantity: 2 },
      ];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(2);
    });

    it('should treat null modelId as base product', () => {
      const items = [
        { productId: 'p1', modelId: null, quantity: 2 },
        { productId: 'p1', modelId: null, quantity: 3 },
      ];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(5);
      expect(result[0].modelId).toBeNull();
    });

    it('should handle empty array', () => {
      expect(inventoryService.aggregateItems([])).toEqual([]);
    });

    it('should handle complex mix', () => {
      const items = [
        { productId: 'p1', modelId: 'v1', quantity: 1 },
        { productId: 'p2', modelId: null, quantity: 2 },
        { productId: 'p1', modelId: 'v1', quantity: 3 },
        { productId: 'p1', modelId: 'v2', quantity: 1 },
        { productId: 'p2', modelId: null, quantity: 1 },
      ];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(3);

      const p1v1 = result.find((i) => i.productId === 'p1' && i.modelId === 'v1');
      const p1v2 = result.find((i) => i.productId === 'p1' && i.modelId === 'v2');
      const p2 = result.find((i) => i.productId === 'p2');

      expect(p1v1.quantity).toBe(4);
      expect(p1v2.quantity).toBe(1);
      expect(p2.quantity).toBe(3);
    });

    it('should handle ObjectId-like toString', () => {
      const id = { toString: () => 'abc123' };
      const items = [
        { productId: id, modelId: null, quantity: 1 },
        { productId: id, modelId: null, quantity: 2 },
      ];
      const result = inventoryService.aggregateItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(3);
    });
  });
});
