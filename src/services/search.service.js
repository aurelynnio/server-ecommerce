const Product = require('../repositories/product.repository');
const Category = require('../repositories/category.repository');
const Shop = require('../repositories/shop.repository');
const redisService = require('./redis.service');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');

/**
 * Service handling advanced search operations
 * Provides search suggestions, history, and trending searches
 */
class SearchService {
  /**
   * Get search suggestions (autocomplete)
   * PERFORMANCE FIX: Re-enabled cache for better performance
   * @param {string} keyword - Search keyword
   * @param {number} [limit=10] - Maximum suggestions
   * @returns {Promise<Object>} Search suggestions grouped by type
   */
  async getSuggestions(keyword, limit = 10) {
    const normalizedKeyword = String(keyword || '').trim();
    if (normalizedKeyword.length < 2) {
      return { products: [], categories: [], shops: [] };
    }

    // PERFORMANCE FIX: Re-enable cache. limit phải nằm trong key, nếu không
    // request limit=5 và limit=10 sẽ dùng chung một kết quả sai.
    const cacheKey = `search:suggestions:${limit}:${normalizedKeyword.toLowerCase()}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    // Search products - Note: images are in variants[].images, not root level
    const products = await Product.findPublishedAutocomplete(normalizedKeyword, limit);

    // Map products to include first variant image for display in 'images' array
    const productsWithImages = products.map((product) => {
      const variantImage = product.variants?.[0]?.images?.[0];
      const images = variantImage ? [variantImage] : product.descriptionImages || [];
      return {
        ...product,
        images,
      };
    });

    const categories = await Category.findActiveByNameRegex(normalizedKeyword, 5);

    const shops = await Shop.findActiveByNameRegex(normalizedKeyword, 5);

    const result = { products: productsWithImages, categories, shops };
    // PERFORMANCE FIX: Cache for 5 minutes
    await redisService.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get trending searches
   * @param {number} [limit=10] - Maximum items
   * @returns {Promise<Array>} Trending search terms
   */
  async getTrendingSearches(limit = 10) {
    const cacheKey = `search:trending:${limit}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    // Get top selling products as trending
    const trendingProducts = await Product.findTrendingProducts(limit);

    const trending = trendingProducts.map((p) => ({
      keyword: p.name,
      type: 'product',
    }));

    await redisService.set(cacheKey, trending, 3600); // 1 hour cache
    return trending;
  }

  /**
   * Get hot keywords (most searched)
   * @param {number} [limit=20] - Maximum items
   * @returns {Promise<Array>} Hot keywords
   */
  async getHotKeywords(limit = 20) {
    const cacheKey = `search:hot-keywords:${limit}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    // Combine trending products and categories
    const [products, categories] = await Promise.all([
      Product.findHotKeywordProducts(limit),
      Category.findActiveNames(10),
    ]);

    const keywords = [...products.map((p) => p.name), ...categories.map((c) => c.name)];

    const uniqueKeywords = [...new Set(keywords)].slice(0, limit);

    await redisService.set(cacheKey, uniqueKeywords, 3600);
    return uniqueKeywords;
  }

  /**
   * Advanced search with filters
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} Search results with facets
   */
  async advancedSearch(params) {
    const {
      keyword,
      category,
      minPrice,
      maxPrice,
      rating,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
    } = params;

    let categoryIds = [];

    if (category) {
      const cat = await Category.findBySlug(category);
      if (!cat) {
        // Slug không tồn tại: trả rỗng thay vì bỏ filter và trả toàn bộ sản phẩm.
        const emptyPagination = getPaginationParams(page, limit, 0);
        return {
          ...buildPaginationResponse([], emptyPagination),
          facets: { priceRanges: [], categories: [], ratings: [] },
        };
      }
      const subcats = await Category.findSubcategoryIds(cat._id);
      categoryIds = [cat._id, ...subcats.map((s) => s._id)];
    }

    const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() : keyword;
    const searchParams = {
      keyword: normalizedKeyword || undefined,
      categoryIds,
      minPrice,
      maxPrice,
      rating,
    };

    const total = await Product.countByAdvancedSearchParams(searchParams);
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.findByAdvancedSearchParams(searchParams, {
      sortBy,
      skip: paginationParams.skip,
      limit: paginationParams.limit,
    });

    const facets = await this.getSearchFacets(searchParams);

    return {
      ...buildPaginationResponse(products, paginationParams),
      facets,
    };
  }

  /**
   * Get search facets for filtering
   * @param {Object} searchParams - Base search params
   * @returns {Promise<Object>} Facets data
   */
  async getSearchFacets(searchParams) {
    const [priceRanges, categories, ratings] = await Product.getSearchFacetsByParams(searchParams);

    return { priceRanges, categories, ratings };
  }
}

module.exports = new SearchService();
