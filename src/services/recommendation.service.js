const Product = require("../models/product.model");
const Order = require("../models/order.model");
const User = require("../models/user.model");
const cacheService = require("./cache.service");

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
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Get user's purchase history
    const orders = await Order.find({
      userId,
      status: { $ne: "cancelled" },
    })
      .select("products.productId")
      .limit(10)
      .lean();

    const purchasedProductIds = orders.flatMap((o) =>
      o.products.map((p) => p.productId.toString())
    );

    // Get categories from purchased products
    const purchasedProducts = await Product.find({
      _id: { $in: purchasedProductIds },
    }).select("category");

    const categoryIds = [...new Set(purchasedProducts.map((p) => p.category?.toString()))];

    // Get user's wishlist
    const user = await User.findById(userId).select("wishlist");
    const wishlistIds = user?.wishlist?.map((id) => id.toString()) || [];

    // Exclude already purchased and wishlisted products
    const excludeIds = [...new Set([...purchasedProductIds, ...wishlistIds])];

    // Find similar products
    let recommendations = [];

    if (categoryIds.length > 0) {
      recommendations = await Product.find({
        _id: { $nin: excludeIds },
        category: { $in: categoryIds },
        status: "published",
      })
        .select("name slug images price ratingAverage soldCount shop")
        .populate("shop", "name logo")
        .sort({ soldCount: -1, ratingAverage: -1 })
        .limit(limit)
        .lean();
    }

    // If not enough, fill with popular products
    if (recommendations.length < limit) {
      const remaining = limit - recommendations.length;
      const existingIds = recommendations.map((p) => p._id.toString());

      const popular = await Product.find({
        _id: { $nin: [...excludeIds, ...existingIds] },
        status: "published",
      })
        .select("name slug images price ratingAverage soldCount shop")
        .populate("shop", "name logo")
        .sort({ soldCount: -1 })
        .limit(remaining)
        .lean();

      recommendations = [...recommendations, ...popular];
    }

    await cacheService.set(cacheKey, recommendations, 1800); // 30 mins
    return recommendations;
  }

  /**
   * Get recommendations for guest users (popular products)
   * @param {number} [limit=20] - Maximum products
   * @returns {Promise<Array>} Popular products
   */
  async getGuestRecommendations(limit = 20) {
    const cacheKey = "recommendations:guest";
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const products = await Product.find({ status: "published" })
      .select("name slug images price ratingAverage soldCount shop category")
      .populate("shop", "name logo")
      .populate("category", "name slug")
      .sort({ soldCount: -1, ratingAverage: -1 })
      .limit(limit)
      .lean();

    await cacheService.set(cacheKey, products, 3600); // 1 hour
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
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Find orders containing this product
    const orders = await Order.find({
      "products.productId": productId,
      status: { $ne: "cancelled" },
    })
      .select("products.productId")
      .limit(100)
      .lean();

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

    const products = await Product.find({
      _id: { $in: sortedIds },
      status: "published",
    })
      .select("name slug images price")
      .lean();

    await cacheService.set(cacheKey, products, 3600);
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
    if (!product) throw new Error("Product not found");

    const priceRange = 0.3; // 30% price difference
    const minPrice = product.price.currentPrice * (1 - priceRange);
    const maxPrice = product.price.currentPrice * (1 + priceRange);

    const similar = await Product.find({
      _id: { $ne: productId },
      category: product.category,
      status: "published",
      "price.currentPrice": { $gte: minPrice, $lte: maxPrice },
    })
      .select("name slug images price ratingAverage soldCount")
      .sort({ ratingAverage: -1, soldCount: -1 })
      .limit(limit)
      .lean();

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
    const viewedIds = await cacheService.get(cacheKey);

    if (!viewedIds || viewedIds.length === 0) return [];

    const products = await Product.find({
      _id: { $in: viewedIds.slice(0, limit) },
      status: "published",
    })
      .select("name slug images price")
      .lean();

    return products;
  }

  /**
   * Track product view for recommendations
   * @param {string} userId - User ID
   * @param {string} productId - Viewed product ID
   */
  async trackProductView(userId, productId) {
    const cacheKey = `user:${userId}:recently-viewed`;
    let viewedIds = (await cacheService.get(cacheKey)) || [];

    // Remove if exists and add to front
    viewedIds = viewedIds.filter((id) => id !== productId);
    viewedIds.unshift(productId);

    // Keep only last 50
    viewedIds = viewedIds.slice(0, 50);

    await cacheService.set(cacheKey, viewedIds, 86400 * 7); // 7 days
  }

  /**
   * Get category-based recommendations
   * @param {string} categoryId - Category ID
   * @param {number} [limit=20] - Maximum products
   * @returns {Promise<Array>} Products in category
   */
  async getCategoryRecommendations(categoryId, limit = 20) {
    const products = await Product.find({
      category: categoryId,
      status: "published",
    })
      .select("name slug images price ratingAverage soldCount")
      .sort({ soldCount: -1, ratingAverage: -1 })
      .limit(limit)
      .lean();

    return products;
  }

  /**
   * Get homepage recommendations (mixed)
   * @param {string} [userId] - Optional user ID for personalization
   * @returns {Promise<Object>} Multiple recommendation sections
   */
  async getHomepageRecommendations(userId = null) {
    const [popular, newArrivals, topRated] = await Promise.all([
      Product.find({ status: "published" })
        .sort({ soldCount: -1 })
        .limit(10)
        .select("name slug images price soldCount")
        .lean(),
      Product.find({ status: "published", isNewArrival: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("name slug images price")
        .lean(),
      Product.find({ status: "published", reviewCount: { $gte: 5 } })
        .sort({ ratingAverage: -1 })
        .limit(10)
        .select("name slug images price ratingAverage")
        .lean(),
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
