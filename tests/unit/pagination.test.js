/**
 * Unit Tests: Pagination Utility
 * Tests pagination parameter calculation and response building
 */
import { describe, it, expect } from 'vitest';

const { getPaginationParams, buildPaginationResponse } = require('../../src/utils/pagination');

describe('Pagination Utility', () => {
  describe('getPaginationParams', () => {
    it('should return correct defaults for first page', () => {
      const result = getPaginationParams(1, 10, 100);

      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalItems).toBe(100);
      expect(result.totalPages).toBe(10);
      expect(result.skip).toBe(0);
      expect(result.limit).toBe(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
      expect(result.nextPage).toBe(2);
      expect(result.prevPage).toBe(null);
    });

    it('should calculate middle page correctly', () => {
      const result = getPaginationParams(5, 10, 100);

      expect(result.currentPage).toBe(5);
      expect(result.skip).toBe(40);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
      expect(result.nextPage).toBe(6);
      expect(result.prevPage).toBe(4);
    });

    it('should handle last page', () => {
      const result = getPaginationParams(10, 10, 100);

      expect(result.currentPage).toBe(10);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
      expect(result.nextPage).toBe(null);
      expect(result.prevPage).toBe(9);
    });

    it('should cap page size at 100', () => {
      const result = getPaginationParams(1, 500, 1000);
      expect(result.pageSize).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('should default to 10 when page size is 0 (falsy)', () => {
      const result = getPaginationParams(1, 0, 50);
      expect(result.pageSize).toBe(10);
    });

    it('should use minimum page size of 1 for negative values', () => {
      const result = getPaginationParams(1, -5, 50);
      expect(result.pageSize).toBe(1);
    });

    it('should default to page 1 for invalid page', () => {
      expect(getPaginationParams(-5, 10, 100).currentPage).toBe(1);
      expect(getPaginationParams(0, 10, 100).currentPage).toBe(1);
      expect(getPaginationParams(null, 10, 100).currentPage).toBe(1);
      expect(getPaginationParams(undefined, 10, 100).currentPage).toBe(1);
      expect(getPaginationParams('abc', 10, 100).currentPage).toBe(1);
    });

    it('should default page size to 10 for invalid input', () => {
      expect(getPaginationParams(1, null, 100).pageSize).toBe(10);
      expect(getPaginationParams(1, undefined, 100).pageSize).toBe(10);
      expect(getPaginationParams(1, 'abc', 100).pageSize).toBe(10);
    });

    it('should handle zero total items', () => {
      const result = getPaginationParams(1, 10, 0);

      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should handle single item', () => {
      const result = getPaginationParams(1, 10, 1);

      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
    });

    it('should handle indivisible totals', () => {
      const result = getPaginationParams(1, 10, 25);

      expect(result.totalPages).toBe(3); // ceil(25/10) = 3
    });

    it('should accept string page and limit', () => {
      const result = getPaginationParams('3', '20', 100);

      expect(result.currentPage).toBe(3);
      expect(result.pageSize).toBe(20);
      expect(result.skip).toBe(40);
    });
  });

  describe('buildPaginationResponse', () => {
    it('should build response with data and pagination metadata', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const params = getPaginationParams(1, 10, 50);
      const response = buildPaginationResponse(data, params);

      expect(response.data).toEqual(data);
      expect(response.pagination).toBeDefined();
      expect(response.pagination.currentPage).toBe(1);
      expect(response.pagination.pageSize).toBe(10);
      expect(response.pagination.totalItems).toBe(50);
      expect(response.pagination.totalPages).toBe(5);
      expect(response.pagination.hasNextPage).toBe(true);
      expect(response.pagination.hasPrevPage).toBe(false);
    });

    it('should handle empty data', () => {
      const params = getPaginationParams(1, 10, 0);
      const response = buildPaginationResponse([], params);

      expect(response.data).toEqual([]);
      expect(response.pagination.totalItems).toBe(0);
    });
  });
});
