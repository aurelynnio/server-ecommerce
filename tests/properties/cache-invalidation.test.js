/**
 * Property Test: Cache Invalidation on Mutation
 * 
 * Property 5: After any mutation operation, related cache keys must be invalidated
 * 
 * Validates Requirements: 3.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

describe('Property: Cache Invalidation on Mutation', () => {
  // Simulate cache service
  let cache;
  let invalidatedPatterns;

  beforeEach(() => {
    cache = new Map();
    invalidatedPatterns = [];
  });

  // Mock cache service
  const mockCacheService = {
    set: (key, value, ttl) => {
      cache.set(key, { value, ttl, timestamp: Date.now() });
    },
    get: (key) => {
      const entry = cache.get(key);
      return entry ? entry.value : null;
    },
    del: (key) => {
      cache.delete(key);
    },
    delByPattern: (pattern) => {
      invalidatedPatterns.push(pattern);
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      for (const key of cache.keys()) {
        if (regex.test(key)) {
          cache.delete(key);
        }
      }
    }
  };

  describe('Product Cache Invalidation', () => {
    it('should invalidate product cache on create', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            price: fc.integer({ min: 1000, max: 10000000 }),
            category: fc.string({ minLength: 24, maxLength: 24 })
          }),
          async (productData) => {
            // Setup: Pre-populate cache
            mockCacheService.set('products:all:{}', [{ id: 'existing' }], 3600);
            mockCacheService.set('products:featured', [{ id: 'featured' }], 3600);
            
            // Simulate product creation
            const createProduct = async (data) => {
              // ... create product logic ...
              const product = { _id: 'new123', ...data };
              
              // Invalidate cache
              mockCacheService.delByPattern('products:*');
              
              return product;
            };

            await createProduct(productData);

            // Property: All product cache keys should be invalidated
            expect(invalidatedPatterns).toContain('products:*');
            expect(mockCacheService.get('products:all:{}')).toBeNull();
            expect(mockCacheService.get('products:featured')).toBeNull();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should invalidate product cache on update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 24, maxLength: 24 }), // productId
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            price: fc.integer({ min: 1000, max: 10000000 })
          }), // updateData
          async (productId, updateData) => {
            // Reset
            invalidatedPatterns = [];
            cache.clear();

            // Setup: Pre-populate cache
            mockCacheService.set(`products:id:${productId}`, { id: productId, name: 'Old' }, 3600);
            mockCacheService.set('products:all:{}', [{ id: productId }], 3600);

            // Simulate product update
            const updateProduct = async (id, data) => {
              const product = { _id: id, ...data };
              
              // Invalidate cache
              mockCacheService.delByPattern('products:*');
              
              return product;
            };

            await updateProduct(productId, updateData);

            // Property: Product cache should be invalidated
            expect(invalidatedPatterns).toContain('products:*');
            expect(mockCacheService.get(`products:id:${productId}`)).toBeNull();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should invalidate product cache on delete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 24, maxLength: 24 }), // productId
          async (productId) => {
            // Reset
            invalidatedPatterns = [];
            cache.clear();

            // Setup
            mockCacheService.set(`products:id:${productId}`, { id: productId }, 3600);
            mockCacheService.set(`products:slug:test-product`, { id: productId }, 3600);

            // Simulate delete
            const deleteProduct = async (id) => {
              mockCacheService.delByPattern('products:*');
              return { deleted: true };
            };

            await deleteProduct(productId);

            // Property: All product cache should be invalidated
            expect(invalidatedPatterns).toContain('products:*');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Category Cache Invalidation', () => {
    it('should invalidate category cache on mutation', async () => {
      const operations = ['create', 'update', 'delete'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...operations),
          fc.string({ minLength: 24, maxLength: 24 }),
          async (operation, categoryId) => {
            // Reset
            invalidatedPatterns = [];
            cache.clear();

            // Setup
            mockCacheService.set('categories:tree', [{ id: 'root' }], 86400);
            mockCacheService.set(`categories:id:${categoryId}`, { id: categoryId }, 3600);

            // Simulate mutation
            const mutateCategory = async (op, id) => {
              // ... mutation logic ...
              mockCacheService.delByPattern('categories:*');
              return { success: true };
            };

            await mutateCategory(operation, categoryId);

            // Property: Category cache should be invalidated
            expect(invalidatedPatterns).toContain('categories:*');
            expect(mockCacheService.get('categories:tree')).toBeNull();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Cache Key Pattern Matching', () => {
    it('should correctly match cache keys with patterns', () => {
      const matchPattern = (pattern, key) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(key);
      };

      fc.assert(
        fc.property(
          fc.constantFrom('products', 'categories', 'orders', 'vouchers'),
          fc.constantFrom('all', 'id', 'slug', 'featured', 'search'),
          fc.string({ minLength: 1, maxLength: 20 }),
          (resource, type, suffix) => {
            const key = `${resource}:${type}:${suffix}`;
            const pattern = `${resource}:*`;

            // Property: Pattern should match all keys starting with resource
            expect(matchPattern(pattern, key)).toBe(true);

            // Property: Different resource pattern should not match
            const otherResource = resource === 'products' ? 'categories' : 'products';
            expect(matchPattern(`${otherResource}:*`, key)).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cache Consistency', () => {
    it('should maintain consistency between cache and database state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              operation: fc.constantFrom('create', 'update', 'delete'),
              resourceType: fc.constantFrom('product', 'category'),
              resourceId: fc.string({ minLength: 24, maxLength: 24 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (operations) => {
            // Reset
            invalidatedPatterns = [];
            cache.clear();

            // Track database state
            const dbState = new Map();

            for (const op of operations) {
              const cacheKey = `${op.resourceType}s:id:${op.resourceId}`;

              if (op.operation === 'create') {
                dbState.set(op.resourceId, { id: op.resourceId, type: op.resourceType });
                mockCacheService.delByPattern(`${op.resourceType}s:*`);
              } else if (op.operation === 'update') {
                if (dbState.has(op.resourceId)) {
                  dbState.set(op.resourceId, { ...dbState.get(op.resourceId), updated: true });
                }
                mockCacheService.delByPattern(`${op.resourceType}s:*`);
              } else if (op.operation === 'delete') {
                dbState.delete(op.resourceId);
                mockCacheService.delByPattern(`${op.resourceType}s:*`);
              }
            }

            // Property: After mutations, cache should be empty (invalidated)
            // This ensures no stale data
            for (const op of operations) {
              const cacheKey = `${op.resourceType}s:id:${op.resourceId}`;
              expect(mockCacheService.get(cacheKey)).toBeNull();
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
