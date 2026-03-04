/**
 * Unit Tests: Search Service Logic
 * Tests suggestion min-length, sort switch, price/rating filter building,
 * hot keywords dedup, product image mapping
 */
import { describe, it, expect } from 'vitest';

describe('SearchService Logic', () => {
  // --- getSuggestions: min keyword length ---
  describe('suggestionMinLength', () => {
    const shouldSearch = (keyword) => {
      return keyword && keyword.length >= 2;
    };

    it('should reject empty keyword', () => {
      expect(shouldSearch('')).toBeFalsy();
    });

    it('should reject null', () => {
      expect(shouldSearch(null)).toBeFalsy();
    });

    it('should reject single character', () => {
      expect(shouldSearch('a')).toBe(false);
    });

    it('should accept 2 characters', () => {
      expect(shouldSearch('ab')).toBe(true);
    });

    it('should accept longer keywords', () => {
      expect(shouldSearch('laptop')).toBe(true);
    });
  });

  // --- Product image mapping from variants ---
  describe('mapProductImages', () => {
    const mapProductImages = (products) => {
      return products.map((product) => {
        const variantImage = product.variants?.[0]?.images?.[0];
        const images = variantImage ? [variantImage] : product.descriptionImages || [];
        return { ...product, images };
      });
    };

    it('should use first variant image', () => {
      const products = [{ name: 'A', variants: [{ images: ['img1.jpg', 'img2.jpg'] }] }];
      const result = mapProductImages(products);
      expect(result[0].images).toEqual(['img1.jpg']);
    });

    it('should fallback to descriptionImages', () => {
      const products = [{ name: 'A', variants: [], descriptionImages: ['desc.jpg'] }];
      const result = mapProductImages(products);
      expect(result[0].images).toEqual(['desc.jpg']);
    });

    it('should return empty array when no images at all', () => {
      const products = [{ name: 'A', variants: [] }];
      const result = mapProductImages(products);
      expect(result[0].images).toEqual([]);
    });

    it('should handle null variants', () => {
      const products = [{ name: 'A' }];
      const result = mapProductImages(products);
      expect(result[0].images).toEqual([]);
    });

    it('should handle variant with empty images array', () => {
      const products = [{ name: 'A', variants: [{ images: [] }], descriptionImages: ['d.jpg'] }];
      const result = mapProductImages(products);
      expect(result[0].images).toEqual(['d.jpg']);
    });
  });

  // --- advancedSearch: sort switch ---
  describe('buildSortOption', () => {
    const buildSort = (sortBy, hasKeyword) => {
      switch (sortBy) {
        case 'price_asc':
          return { 'price.currentPrice': 1 };
        case 'price_desc':
          return { 'price.currentPrice': -1 };
        case 'newest':
          return { createdAt: -1 };
        case 'bestselling':
          return { soldCount: -1 };
        case 'rating':
          return { ratingAverage: -1 };
        default:
          if (hasKeyword) {
            return { score: { $meta: 'textScore' } };
          }
          return { createdAt: -1 };
      }
    };

    it('should sort by price ascending', () => {
      expect(buildSort('price_asc', false)).toEqual({
        'price.currentPrice': 1,
      });
    });

    it('should sort by price descending', () => {
      expect(buildSort('price_desc', false)).toEqual({
        'price.currentPrice': -1,
      });
    });

    it('should sort by newest', () => {
      expect(buildSort('newest', false)).toEqual({ createdAt: -1 });
    });

    it('should sort by bestselling', () => {
      expect(buildSort('bestselling', false)).toEqual({ soldCount: -1 });
    });

    it('should sort by rating', () => {
      expect(buildSort('rating', false)).toEqual({ ratingAverage: -1 });
    });

    it('should use textScore for relevance with keyword', () => {
      expect(buildSort('relevance', true)).toEqual({
        score: { $meta: 'textScore' },
      });
    });

    it('should fallback to newest for relevance without keyword', () => {
      expect(buildSort('relevance', false)).toEqual({ createdAt: -1 });
    });

    it('should fallback for unknown sortBy with keyword', () => {
      expect(buildSort('unknown', true)).toEqual({
        score: { $meta: 'textScore' },
      });
    });
  });

  // --- advancedSearch: price filter builder ---
  describe('buildPriceFilter', () => {
    const buildPriceFilter = (minPrice, maxPrice) => {
      if (!minPrice && !maxPrice) return null;
      const filter = {};
      if (minPrice) filter.$gte = Number(minPrice);
      if (maxPrice) filter.$lte = Number(maxPrice);
      return filter;
    };

    it('should build gte filter for minPrice only', () => {
      expect(buildPriceFilter(100000, null)).toEqual({ $gte: 100000 });
    });

    it('should build lte filter for maxPrice only', () => {
      expect(buildPriceFilter(null, 500000)).toEqual({ $lte: 500000 });
    });

    it('should build range filter for both', () => {
      expect(buildPriceFilter(100000, 500000)).toEqual({
        $gte: 100000,
        $lte: 500000,
      });
    });

    it('should return null when no price specified', () => {
      expect(buildPriceFilter(null, null)).toBeNull();
    });

    it('should convert string values to numbers', () => {
      expect(buildPriceFilter('100000', '500000')).toEqual({
        $gte: 100000,
        $lte: 500000,
      });
    });
  });

  // --- advancedSearch: rating filter ---
  describe('buildRatingFilter', () => {
    const buildRatingFilter = (rating) => {
      if (!rating) return null;
      return { $gte: Number(rating) };
    };

    it('should build gte filter', () => {
      expect(buildRatingFilter(4)).toEqual({ $gte: 4 });
    });

    it('should convert string to number', () => {
      expect(buildRatingFilter('4.5')).toEqual({ $gte: 4.5 });
    });

    it('should return null for no rating', () => {
      expect(buildRatingFilter(null)).toBeNull();
      expect(buildRatingFilter(undefined)).toBeNull();
    });
  });

  // --- getHotKeywords: unique keywords ---
  describe('uniqueKeywords', () => {
    const getUniqueKeywords = (products, categories, limit) => {
      const keywords = [...products.map((p) => p.name), ...categories.map((c) => c.name)];
      return [...new Set(keywords)].slice(0, limit);
    };

    it('should remove duplicates', () => {
      const products = [{ name: 'Laptop' }, { name: 'Phone' }];
      const categories = [{ name: 'Laptop' }, { name: 'Tablet' }];
      const result = getUniqueKeywords(products, categories, 20);
      expect(result).toEqual(['Laptop', 'Phone', 'Tablet']);
    });

    it('should respect limit', () => {
      const products = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
      const result = getUniqueKeywords(products, [], 2);
      expect(result).toHaveLength(2);
    });

    it('should handle empty inputs', () => {
      expect(getUniqueKeywords([], [], 10)).toEqual([]);
    });

    it('should prioritize products over categories (order)', () => {
      const products = [{ name: 'X' }];
      const categories = [{ name: 'Y' }];
      const result = getUniqueKeywords(products, categories, 10);
      expect(result[0]).toBe('X');
      expect(result[1]).toBe('Y');
    });
  });

  // --- getTrendingSearches: transform ---
  describe('trendingTransform', () => {
    const transformTrending = (products) => {
      return products.map((p) => ({
        keyword: p.name,
        type: 'product',
      }));
    };

    it('should transform product names to trending keywords', () => {
      const result = transformTrending([{ name: 'iPhone 15' }, { name: 'Samsung Galaxy' }]);
      expect(result).toEqual([
        { keyword: 'iPhone 15', type: 'product' },
        { keyword: 'Samsung Galaxy', type: 'product' },
      ]);
    });

    it('should handle empty array', () => {
      expect(transformTrending([])).toEqual([]);
    });
  });

  // --- advancedSearch: full query builder ---
  describe('buildSearchQuery', () => {
    const buildQuery = ({ keyword, minPrice, maxPrice, rating }) => {
      const query = { status: 'published' };

      if (keyword) {
        query.$text = { $search: keyword };
      }

      if (minPrice || maxPrice) {
        query['price.currentPrice'] = {};
        if (minPrice) query['price.currentPrice'].$gte = Number(minPrice);
        if (maxPrice) query['price.currentPrice'].$lte = Number(maxPrice);
      }

      if (rating) {
        query.ratingAverage = { $gte: Number(rating) };
      }

      return query;
    };

    it('should always include published status', () => {
      const result = buildQuery({});
      expect(result.status).toBe('published');
    });

    it('should add text search for keyword', () => {
      const result = buildQuery({ keyword: 'laptop' });
      expect(result.$text).toEqual({ $search: 'laptop' });
    });

    it('should add price range filter', () => {
      const result = buildQuery({ minPrice: 100, maxPrice: 500 });
      expect(result['price.currentPrice']).toEqual({ $gte: 100, $lte: 500 });
    });

    it('should add rating filter', () => {
      const result = buildQuery({ rating: 4 });
      expect(result.ratingAverage).toEqual({ $gte: 4 });
    });

    it('should combine all filters', () => {
      const result = buildQuery({
        keyword: 'phone',
        minPrice: 100,
        maxPrice: 1000,
        rating: 4,
      });
      expect(result.status).toBe('published');
      expect(result.$text).toBeDefined();
      expect(result['price.currentPrice'].$gte).toBe(100);
      expect(result.ratingAverage.$gte).toBe(4);
    });
  });
});
