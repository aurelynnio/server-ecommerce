/**
 * Unit tests cho search.service + product.repository — import code thật,
 * chỉ mock biên DB/Redis.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Product = require('../../src/repositories/product.repository');
const Category = require('../../src/repositories/category.repository');
const Shop = require('../../src/repositories/shop.repository');
const redisService = require('../../src/services/redis.service');
const searchService = require('../../src/services/search.service');

describe('search.service (real module)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(redisService, 'get').mockResolvedValue(null);
    vi.spyOn(redisService, 'set').mockResolvedValue(undefined);
  });

  describe('getSuggestions()', () => {
    it('skips repositories for keywords shorter than 2 chars', async () => {
      const productsSpy = vi.spyOn(Product, 'findPublishedAutocomplete');
      const categoriesSpy = vi.spyOn(Category, 'findActiveByNameRegex');
      const shopsSpy = vi.spyOn(Shop, 'findActiveByNameRegex');

      const result = await searchService.getSuggestions('a', 10);

      expect(result).toEqual({ products: [], categories: [], shops: [] });
      expect(productsSpy).not.toHaveBeenCalled();
      expect(categoriesSpy).not.toHaveBeenCalled();
      expect(shopsSpy).not.toHaveBeenCalled();
    });

    it('includes limit in the Redis cache key', async () => {
      vi.spyOn(Product, 'findPublishedAutocomplete').mockResolvedValue([]);
      vi.spyOn(Category, 'findActiveByNameRegex').mockResolvedValue([]);
      vi.spyOn(Shop, 'findActiveByNameRegex').mockResolvedValue([]);

      await searchService.getSuggestions('Laptop', 5);

      expect(redisService.set).toHaveBeenCalledWith(
        'search:suggestions:5:laptop',
        expect.anything(),
        300,
      );
    });
  });

  describe('getTrendingSearches() / getHotKeywords()', () => {
    it('includes limit in trending cache key', async () => {
      vi.spyOn(Product, 'findTrendingProducts').mockResolvedValue([]);

      await searchService.getTrendingSearches(7);

      expect(redisService.set).toHaveBeenCalledWith('search:trending:7', [], 3600);
    });

    it('includes limit in hot-keywords cache key', async () => {
      vi.spyOn(Product, 'findHotKeywordProducts').mockResolvedValue([]);
      vi.spyOn(Category, 'findActiveNames').mockResolvedValue([]);

      await searchService.getHotKeywords(9);

      expect(redisService.set).toHaveBeenCalledWith('search:hot-keywords:9', [], 3600);
    });
  });

  describe('advancedSearch()', () => {
    const mockFacets = () => vi.spyOn(Product, 'getSearchFacetsByParams').mockResolvedValue([[], [], []]);

    it('returns an empty page when the category slug does not exist', async () => {
      vi.spyOn(Category, 'findBySlug').mockResolvedValue(null);
      const countSpy = vi.spyOn(Product, 'countByAdvancedSearchParams');
      const findSpy = vi.spyOn(Product, 'findByAdvancedSearchParams');

      const result = await searchService.advancedSearch({ category: 'khong-ton-tai' });

      expect(result.data).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.facets).toEqual({ priceRanges: [], categories: [], ratings: [] });
      expect(countSpy).not.toHaveBeenCalled();
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('passes minPrice=0 to the repository instead of dropping it', async () => {
      vi.spyOn(Category, 'findBySlug').mockResolvedValue({ _id: 'cat-1' });
      vi.spyOn(Category, 'findSubcategoryIds').mockResolvedValue([]);
      const countSpy = vi.spyOn(Product, 'countByAdvancedSearchParams').mockResolvedValue(0);
      const findSpy = vi.spyOn(Product, 'findByAdvancedSearchParams').mockResolvedValue([]);
      mockFacets();

      await searchService.advancedSearch({ minPrice: 0, maxPrice: 500000, page: 1, limit: 20 });

      expect(countSpy).toHaveBeenCalledWith(
        expect.objectContaining({ minPrice: 0, maxPrice: 500000 }),
      );
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ minPrice: 0, maxPrice: 500000 }),
        expect.any(Object),
      );
    });
  });

  describe('product.repository facets', () => {
    it('keeps minPrice=0 in the $match and uses 5.1 as the rating upper bound', async () => {
      const aggregateSpy = vi.spyOn(Product, 'aggregateByPipeline').mockResolvedValue([{}]);

      await Product.getSearchFacetsByParams({ minPrice: 0, maxPrice: 500000 });

      const [pipeline] = aggregateSpy.mock.calls[0];
      const match = pipeline.find((stage) => stage.$match).$match;
      expect(match['price.currentPrice']).toEqual({ $gte: 0, $lte: 500000 });

      const ratingBucket = pipeline.find((stage) => stage.$facet).$facet.ratings[0].$bucket;
      expect(ratingBucket.boundaries.at(-1)).toBe(5.1);
    });
  });
});
