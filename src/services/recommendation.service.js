const Product = require("../repositories/product.repository");
const Order = require("../repositories/order.repository");
const Wishlist = require("../repositories/wishlist.repository");
const redisService = require("./redis.service");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");


/**
 * Service handling product recommendations
 * Provides personalized and general product suggestions (like Taobao's "Guess You Like")
 */
class RecommendationService {
  /**
   * Get personalized recommendations for user ("Guess You Like")
   * @param {string} userId - User ID
   * @param {number} [limit=20] - Maximum products
   * @returns {Promise<Array>} Recommended products
   */
  async getPersonalizedRecommendations(userId, limit = 20) {
    const cacheKey = `recommendations:user:${userId}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    // Get user's purchase history
    const orders = await Order.findRecentNonCancelledOrdersByUser(userId, 10);

    const purchasedProductIds = orders.flatMap((o) =>
      o.products.map((p) => p.productId.toString())
    );

    // Get categories from purchased products
    const purchasedProducts = await Product.findByIdsSelectCategory(
      purchasedProductIds,
    );

    const categoryIds = [...new Set(purchasedProducts.map((p) => p.category?.toString()))];

    // Get user's wishlist from Wishlist collection
    const wishlistEntries = await Wishlist.findProductIdsByUserIdAll(userId);
    const wishlistIds = wishlistEntries.map((e) => e.productId.toString());

    // Exclude already purchased and wishlisted products
    const excludeIds = [...new Set([...purchasedProductIds, ...wishlistIds])];

    // Find similar products
    let recommendations = [];

    if (categoryIds.length > 0) {
      recommendations = await Product.findPersonalizedByCategory(
        categoryIds,
        excludeIds,
        limit,
      );
    }

    // If not enough, fill with popular products
    if (recommendations.length < limit) {
      const remaining = limit - recommendations.length;
      const existingIds = recommendations.map((p) => p._id.toString());

      const popular = await Product.findPopularExcludingIds(
        [...excludeIds, ...existingIds],
        remaining,
      );

      recommendations = [...recommendations, ...popular];
    }

    await redisService.set(cacheKey, recommendations, 1800); // 30 mins
    return recommendations;
  }

  /**
   * Get recommendations for guest users (popular products)
   * @param {number} [limit=20] - Maximum products
   * @returns {Promise<Array>} Popular products
   */
  async getGuestRecommendations(limit = 20) {
    const cacheKey = "recommendations:guest";
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    const products = await Product.findGuestRecommendations(limit);

    await redisService.set(cacheKey, products, 3600); // 1 hour
    return products;
  }

  /**
   * Get "Frequently Bought Together" products
   * @param {string} productId - Current product ID
   * @param {number} [limit=5] - Maximum products
   * @returns {Promise<Array>} Related products
   */
  async getFrequentlyBoughtTogether(productId, limit = 5) {
    const cacheKey = `recommendations:fbt:${productId}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    // Find orders containing this product
    const orders = await Order.findOrdersContainingProduct(productId, 100);

    // Count co-occurrence of other products
    const productCounts = {};
    orders.forEach((order) => {
      order.products.forEach((p) => {
        const id = p.productId.toString();
        if (id !== productId) {
          productCounts[id] = (productCounts[id] || 0) + 1;
        }
      });
    });

    // Sort by frequency
    const sortedIds = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    const products = await Product.findPublishedByIdsBasic(sortedIds);

    await redisService.set(cacheKey, products, 3600);
    return products;
  }

  /**
   * Get "Similar Products" based on category and price
   * @param {string} productId - Current product ID
   * @param {number} [limit=10] - Maximum products
   * @returns {Promise<Array>} Similar products
   */
  async getSimilarProducts(productId, limit = 10) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }


    const priceRange = 0.3; // 30% price difference
    const minPrice = product.price.currentPrice * (1 - priceRange);
    const maxPrice = product.price.currentPrice * (1 + priceRange);

    const similar = await Product.findSimilarByCategoryAndPrice(
      productId,
      product.category,
      minPrice,
      maxPrice,
      limit,
    );

    return similar;
  }

  /**
   * Get "Recently Viewed" products for user
   * @param {string} userId - User ID
   * @param {number} [limit=10] - Maximum products
   * @returns {Promise<Array>} Recently viewed products
   */
  async getRecentlyViewed(userId, limit = 10) {
    const cacheKey = `user:${userId}:recently-viewed`;
    const viewedIds = await redisService.get(cacheKey);

    if (!viewedIds || viewedIds.length === 0) return [];

    const products = await Product.findPublishedByIdsForRecent(viewedIds, limit);

    return products;
  }

  /**
   * Track product view for recommendations
   * @param {string} userId - User ID
   * @param {string} productId - Viewed product ID
   */
  async trackProductView(userId, productId) {
    const cacheKey = `user:${userId}:recently-viewed`;
    let viewedIds = (await redisService.get(cacheKey)) || [];

    // Remove if exists and add to front
    viewedIds = viewedIds.filter((id) => id !== productId);
    viewedIds.unshift(productId);

    // Keep only last 50
    viewedIds = viewedIds.slice(0, 50);

    await redisService.set(cacheKey, viewedIds, 86400 * 7); // 7 days
  }

  /**
   * Get category-based recommendations
   * @param {string} categoryId - Category ID
   * @param {number} [limit=20] - Maximum products
   * @returns {Promise<Array>} Products in category
   */
  async getCategoryRecommendations(categoryId, limit = 20) {
    const products = await Product.findCategoryRecommendations(categoryId, limit);

    return products;
  }

  /**
   * Get homepage recommendations (mixed)
   * @param {string} [userId] - Optional user ID for personalization
   * @returns {Promise<Object>} Multiple recommendation sections
   */
  async getHomepageRecommendations(userId = null) {
    const [popular, newArrivals, topRated] = await Promise.all([
      Product.findHomepagePopular(10),
      Product.findHomepageNewArrivals(10),
      Product.findHomepageTopRated(10),
    ]);

    let personalized = [];
    if (userId) {
      personalized = await this.getPersonalizedRecommendations(userId, 10);
    }

    return {
      popular,
      newArrivals,
      topRated,
      forYou: personalized,
    };
  }
}

module.exports = new RecommendationService();


