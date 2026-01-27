const Product = require("../models/product.model");
const Category = require("../models/category.model");
const Shop = require("../models/shop.model");
const cacheService = require("./cache.service");

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
    if (!keyword || keyword.length < 2) {
      return { products: [], categories: [], shops: [] };
    }

    // PERFORMANCE FIX: Re-enable cache
    const cacheKey = `search:suggestions:${keyword.toLowerCase()}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const regex = new RegExp(keyword, "i");

    // Search products - Note: images are in variants[].images, not root level
    const products = await Product.find({
      status: "published",
      $or: [{ name: regex }, { tags: regex }],
    })
      .select("name slug price variants")
      .limit(limit)
      .lean();

    // Map products to include first variant image for display in 'images' array
    const productsWithImages = products.map((product) => {
      const variantImage = product.variants?.[0]?.images?.[0];
      const images = variantImage
        ? [variantImage]
        : product.descriptionImages || [];
      return {
        ...product,
        images,
      };
    });

    // Search categories
    const categories = await Category.find({
      isActive: true,
      name: regex,
    })
      .select("name slug images")
      .limit(5)
      .lean();

    // Search shops
    const shops = await Shop.find({
      status: "active",
      name: regex,
    })
      .select("name slug logo")
      .limit(5)
      .lean();

    const result = { products: productsWithImages, categories, shops };
    // PERFORMANCE FIX: Cache for 5 minutes
    await cacheService.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get trending searches
   * @param {number} [limit=10] - Maximum items
   * @returns {Promise<Array>} Trending search terms
   */
  async getTrendingSearches(limit = 10) {
    const cacheKey = "search:trending";
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Get top selling products as trending
    const trendingProducts = await Product.find({ status: "published" })
      .sort({ soldCount: -1 })
      .select("name")
      .limit(limit)
      .lean();

    const trending = trendingProducts.map((p) => ({
      keyword: p.name,
      type: "product",
    }));

    await cacheService.set(cacheKey, trending, 3600); // 1 hour cache
    return trending;
  }

  /**
   * Get hot keywords (most searched)
   * @param {number} [limit=20] - Maximum items
   * @returns {Promise<Array>} Hot keywords
   */
  async getHotKeywords(limit = 20) {
    const cacheKey = "search:hot-keywords";
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Combine trending products and categories
    const [products, categories] = await Promise.all([
      Product.find({ status: "published" })
        .sort({ soldCount: -1, ratingAverage: -1 })
        .select("name tags")
        .limit(limit)
        .lean(),
      Category.find({ isActive: true }).select("name").limit(10).lean(),
    ]);

    const keywords = [
      ...products.map((p) => p.name),
      ...categories.map((c) => c.name),
    ];

    // Remove duplicates and limit
    const uniqueKeywords = [...new Set(keywords)].slice(0, limit);

    await cacheService.set(cacheKey, uniqueKeywords, 3600);
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
      sortBy = "relevance",
      page = 1,
      limit = 20,
    } = params;

    const query = { status: "published" };

    // Text search
    if (keyword) {
      query.$text = { $search: keyword };
    }

    // Category filter
    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) {
        // Include subcategories
        const subcats = await Category.find({ parentCategory: cat._id }).select(
          "_id"
        );
        const categoryIds = [cat._id, ...subcats.map((s) => s._id)];
        query.category = { $in: categoryIds };
      }
    }

    // Price filter
    if (minPrice || maxPrice) {
      query["price.currentPrice"] = {};
      if (minPrice) query["price.currentPrice"].$gte = Number(minPrice);
      if (maxPrice) query["price.currentPrice"].$lte = Number(maxPrice);
    }

    // Rating filter
    if (rating) {
      query.ratingAverage = { $gte: Number(rating) };
    }

    // Sorting
    let sort = {};
    switch (sortBy) {
      case "price_asc":
        sort = { "price.currentPrice": 1 };
        break;
      case "price_desc":
        sort = { "price.currentPrice": -1 };
        break;
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "bestselling":
        sort = { soldCount: -1 };
        break;
      case "rating":
        sort = { ratingAverage: -1 };
        break;
      default:
        if (keyword) {
          sort = { score: { $meta: "textScore" } };
        } else {
          sort = { createdAt: -1 };
        }
    }

    const total = await Product.countDocuments(query);
    const skip = (page - 1) * limit;

    let productsQuery = Product.find(query)
      .populate("category", "name slug")
      .populate("shop", "name logo");

    if (keyword) {
      productsQuery = productsQuery.select({ score: { $meta: "textScore" } });
    }

    const products = await productsQuery
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get facets (aggregations for filters)
    const facets = await this.getSearchFacets(query);

    const totalPages = Math.ceil(total / limit);
    const currentPage = page;

    return {
      data: products,
      pagination: {
        currentPage,
        pageSize: limit,
        totalItems: total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
      },
      facets,
    };
  }

  /**
   * Get search facets for filtering
   * @param {Object} baseQuery - Base search query
   * @returns {Promise<Object>} Facets data
   */
  async getSearchFacets(baseQuery) {
    const [priceRanges, categories, ratings] = await Promise.all([
      // Price ranges
      Product.aggregate([
        { $match: baseQuery },
        {
          $bucket: {
            groupBy: "$price.currentPrice",
            boundaries: [0, 100000, 500000, 1000000, 5000000, Infinity],
            default: "Other",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      // Categories
      Product.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $project: {
            _id: "$category._id",
            name: "$category.name",
            slug: "$category.slug",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Ratings
      Product.aggregate([
        { $match: baseQuery },
        {
          $bucket: {
            groupBy: "$ratingAverage",
            boundaries: [0, 3, 4, 4.5, 5],
            default: "unrated",
            output: { count: { $sum: 1 } },
          },
        },
      ]),
    ]);

    return { priceRanges, categories, ratings };
  }
}

module.exports = new SearchService();
