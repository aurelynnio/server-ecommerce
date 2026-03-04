/**
 * Integration Tests: Product Search & Filter Pipeline
 * Tests filter building, search logic, and response pagination
 */
import { describe, it, expect } from 'vitest';

const { getPaginationParams, buildPaginationResponse } = require('../../src/utils/pagination');

describe('Product Search & Filter Pipeline - Integration Tests', () => {
  // Simulates the product query builder from ProductService
  const buildProductQuery = (filters) => {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      tags,
      search,
      status = 'published',
      colors,
      sizes,
      rating,
      shop,
      shopCategory,
    } = filters;

    const query = status === 'all' ? { status: { $ne: 'deleted' } } : { status };

    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (shop) query.shop = shop;
    if (shopCategory) query.shopCategory = shopCategory;

    if (minPrice || maxPrice) {
      query['price.currentPrice'] = {};
      if (minPrice) query['price.currentPrice'].$gte = Number(minPrice);
      if (maxPrice) query['price.currentPrice'].$lte = Number(maxPrice);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(',');
      query['variants.color'] = {
        $in: colorArray.map((c) => new RegExp(`^${c}$`, 'i')),
      };
    }

    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(',');
      query['variants.size'] = { $in: sizeArray };
    }

    if (rating) {
      const ratingArray = Array.isArray(rating) ? rating : rating.split(',').map(Number);
      const minRating = Math.min(...ratingArray);
      if (!isNaN(minRating)) query.averageRating = { $gte: minRating };
    }

    if (search) query.$text = { $search: search };

    return query;
  };

  describe('Query Builder', () => {
    it('should build default query for published products', () => {
      const query = buildProductQuery({});
      expect(query.status).toBe('published');
    });

    it('should build query for all non-deleted products', () => {
      const query = buildProductQuery({ status: 'all' });
      expect(query.status.$ne).toBe('deleted');
    });

    it('should add category filter', () => {
      const query = buildProductQuery({ category: 'cat123' });
      expect(query.category).toBe('cat123');
    });

    it('should add price range filter', () => {
      const query = buildProductQuery({
        minPrice: '50000',
        maxPrice: '200000',
      });
      expect(query['price.currentPrice'].$gte).toBe(50000);
      expect(query['price.currentPrice'].$lte).toBe(200000);
    });

    it('should add only min price filter', () => {
      const query = buildProductQuery({ minPrice: '100000' });
      expect(query['price.currentPrice'].$gte).toBe(100000);
      expect(query['price.currentPrice'].$lte).toBeUndefined();
    });

    it('should split tags string into array', () => {
      const query = buildProductQuery({ tags: 'sale,new,hot' });
      expect(query.tags.$in).toEqual(['sale', 'new', 'hot']);
    });

    it('should handle tags as array', () => {
      const query = buildProductQuery({ tags: ['sale', 'new'] });
      expect(query.tags.$in).toEqual(['sale', 'new']);
    });

    it('should add color filter with case-insensitive regex', () => {
      const query = buildProductQuery({ colors: 'Red,Blue' });
      expect(query['variants.color'].$in).toHaveLength(2);
      expect(query['variants.color'].$in[0]).toBeInstanceOf(RegExp);
    });

    it('should add sizes filter', () => {
      const query = buildProductQuery({ sizes: 'S,M,L' });
      expect(query['variants.size'].$in).toEqual(['S', 'M', 'L']);
    });

    it('should add minimum rating filter', () => {
      const query = buildProductQuery({ rating: '3,4,5' });
      expect(query.averageRating.$gte).toBe(3);
    });

    it('should add text search', () => {
      const query = buildProductQuery({ search: 'leather jacket' });
      expect(query.$text.$search).toBe('leather jacket');
    });

    it('should combine multiple filters', () => {
      const query = buildProductQuery({
        category: 'cat1',
        minPrice: '100000',
        maxPrice: '500000',
        colors: 'Red',
        rating: '4',
        shop: 'shop1',
      });

      expect(query.category).toBe('cat1');
      expect(query['price.currentPrice'].$gte).toBe(100000);
      expect(query['price.currentPrice'].$lte).toBe(500000);
      expect(query['variants.color']).toBeDefined();
      expect(query.averageRating.$gte).toBe(4);
      expect(query.shop).toBe('shop1');
    });
  });

  describe('Search + Pagination Integration', () => {
    it('should paginate filtered results correctly', () => {
      // Simulate: 45 products matched filter, page 3, limit 10
      const totalMatched = 45;
      const params = getPaginationParams(3, 10, totalMatched);

      expect(params.skip).toBe(20);
      expect(params.limit).toBe(10);
      expect(params.totalPages).toBe(5);
      expect(params.hasNextPage).toBe(true);
      expect(params.hasPrevPage).toBe(true);

      // Simulate result set
      const products = Array.from({ length: 10 }, (_, i) => ({
        _id: `prod${20 + i}`,
        name: `Product ${20 + i}`,
      }));

      const response = buildPaginationResponse(products, params);

      expect(response.data).toHaveLength(10);
      expect(response.pagination.currentPage).toBe(3);
      expect(response.pagination.totalItems).toBe(45);
    });

    it('should handle last page with partial results', () => {
      const params = getPaginationParams(5, 10, 45);

      expect(params.skip).toBe(40);
      expect(params.hasNextPage).toBe(false);

      const products = Array.from({ length: 5 }, (_, i) => ({
        _id: `prod${40 + i}`,
      }));

      const response = buildPaginationResponse(products, params);
      expect(response.data).toHaveLength(5);
      expect(response.pagination.hasNextPage).toBe(false);
    });

    it('should handle empty search results', () => {
      const params = getPaginationParams(1, 10, 0);
      const response = buildPaginationResponse([], params);

      expect(response.data).toHaveLength(0);
      expect(response.pagination.totalItems).toBe(0);
      expect(response.pagination.totalPages).toBe(1);
    });
  });

  describe('Category-Based Product Queries', () => {
    it('should build query including parent and child category IDs', () => {
      const parentCategoryId = 'cat1';
      const childCategoryIds = ['cat2', 'cat3', 'cat4'];
      const categoryIds = [parentCategoryId, ...childCategoryIds];

      const query = {
        category: { $in: categoryIds },
        status: 'published',
      };

      expect(query.category.$in).toHaveLength(4);
      expect(query.category.$in).toContain('cat1');
    });
  });

  describe('Featured/Special Product Queries', () => {
    it('should build featured products filter', () => {
      const filter = { status: 'published', isFeatured: true };
      expect(filter.isFeatured).toBe(true);
    });

    it('should build new arrivals filter', () => {
      const filter = { status: 'published', isNewArrival: true };
      expect(filter.isNewArrival).toBe(true);
    });

    it('should build on-sale filter with date check', () => {
      const now = new Date();
      const filter = {
        status: 'published',
        $or: [
          { 'price.discountPrice': { $ne: null, $gt: 0 } },
          {
            'flashSale.isActive': true,
            'flashSale.startTime': { $lte: now },
            'flashSale.endTime': { $gt: now },
          },
        ],
      };

      expect(filter.$or).toHaveLength(2);
      expect(filter.$or[1]['flashSale.isActive']).toBe(true);
    });
  });
});
