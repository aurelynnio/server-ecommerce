const Wishlist = require("../models/wishlist.model");
const Product = require("../models/product.model");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");
const { getPaginationParams, buildPaginationResponse } = require("../utils/pagination");



/**
 * Service handling wishlist/favorites operations
 * Manages user's favorite products list using separate Wishlist collection
 */
class WishlistService {
  /**
   * Get user's wishlist
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @returns {Promise<Object>} Wishlist with pagination
   */
  async getWishlist(userId, { page = 1, limit = 10 } = {}) {
    const total = await Wishlist.countDocuments({ userId });
    const paginationParams = getPaginationParams(page, limit, total);

    // Get paginated wishlist entries
    const wishlistEntries = await Wishlist.find({ userId })
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .select("productId")
      .lean();

    const productIds = wishlistEntries.map((entry) => entry.productId);

    // Fetch products with details
    const products = await Product.find({
      _id: { $in: productIds },
      status: "published",
    })
      .select("name slug price ratingAverage reviewCount soldCount shop variants.images variants.name variants.color")
      .populate("shop", "name logo")
      .populate("category", "name slug")
      .lean();

    // Map products to include first variant image
    const productsWithImages = products.map((product) => ({
      ...product,
      image: product.variants?.[0]?.images?.[0] || null,
    }));

    return buildPaginationResponse(productsWithImages, paginationParams);
  }

  /**
   * Add product to wishlist
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Updated wishlist info
   */
  async addToWishlist(userId, productId) {
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }
    if (product.status !== "published") {
      throw new ApiError(StatusCodes.CONFLICT, "Product is not available");
    }

    // Check if already in wishlist
    const existing = await Wishlist.findOne({ userId, productId });
    if (existing) {
      throw new ApiError(StatusCodes.CONFLICT, "Product already in wishlist");
    }

    await Wishlist.create({ userId, productId });

    const wishlistCount = await Wishlist.countDocuments({ userId });

    return {
      message: "Product added to wishlist",
      productId,
      wishlistCount,
    };
  }

  /**
   * Remove product from wishlist
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Updated wishlist info
   */
  async removeFromWishlist(userId, productId) {
    await Wishlist.deleteOne({ userId, productId });

    const wishlistCount = await Wishlist.countDocuments({ userId });

    return {
      message: "Product removed from wishlist",
      productId,
      wishlistCount,
    };
  }

  /**
   * Check if product is in wishlist
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @returns {Promise<boolean>} True if in wishlist
   */
  async isInWishlist(userId, productId) {
    const entry = await Wishlist.findOne({ userId, productId }).lean();
    return !!entry;
  }

  /**
   * Clear entire wishlist
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Confirmation message
   */
  async clearWishlist(userId) {
    await Wishlist.deleteMany({ userId });
    return { message: "Wishlist cleared successfully" };
  }

  /**
   * Get wishlist count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of items in wishlist
   */
  async getWishlistCount(userId) {
    return await Wishlist.countDocuments({ userId });
  }

  /**
   * Check multiple products in wishlist
   * @param {string} userId - User ID
   * @param {string[]} productIds - Array of product IDs
   * @returns {Promise<Object>} Map of productId to boolean
   */
  async checkMultipleInWishlist(userId, productIds) {
    const entries = await Wishlist.find({
      userId,
      productId: { $in: productIds },
    })
      .select("productId")
      .lean();

    const wishlistSet = new Set(entries.map((e) => e.productId.toString()));
    const result = {};
    productIds.forEach((id) => {
      result[id] = wishlistSet.has(id.toString());
    });
    return result;
  }
}

module.exports = new WishlistService();
