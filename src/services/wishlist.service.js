const User = require("../models/user.model");
const Product = require("../models/product.model");

/**
 * Service handling wishlist/favorites operations
 * Manages user's favorite products list
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
    const user = await User.findById(userId).select("wishlist");
    if (!user) throw new Error("User not found");

    const wishlistIds = user.wishlist || [];
    const total = wishlistIds.length;
    const skip = (page - 1) * limit;

    // Get paginated product IDs
    const paginatedIds = wishlistIds.slice(skip, skip + limit);

    // Fetch products with details - Note: images are in variants[].images
    const products = await Product.find({
      _id: { $in: paginatedIds },
      status: "published",
    })
      .select("name slug price ratingAverage reviewCount soldCount shop variants.images variants.name variants.color")
      .populate("shop", "name logo")
      .populate("category", "name slug")
      .lean();

    // Map products to include first variant image
    const productsWithImages = products.map(product => ({
      ...product,
      image: product.variants?.[0]?.images?.[0] || null,
    }));

    return {
      data: productsWithImages,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
        hasPrevPage: page > 1,
      },
    };
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
    if (!product) throw new Error("Product not found");
    if (product.status !== "published") throw new Error("Product is not available");

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Check if already in wishlist
    if (user.wishlist && user.wishlist.includes(productId)) {
      throw new Error("Product already in wishlist");
    }

    // Add to wishlist
    await User.findByIdAndUpdate(userId, {
      $addToSet: { wishlist: productId },
    });

    return {
      message: "Product added to wishlist",
      productId,
      wishlistCount: (user.wishlist?.length || 0) + 1,
    };
  }

  /**
   * Remove product from wishlist
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Updated wishlist info
   */
  async removeFromWishlist(userId, productId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId },
    });

    return {
      message: "Product removed from wishlist",
      productId,
      wishlistCount: Math.max(0, (user.wishlist?.length || 1) - 1),
    };
  }

  /**
   * Check if product is in wishlist
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @returns {Promise<boolean>} True if in wishlist
   */
  async isInWishlist(userId, productId) {
    const user = await User.findById(userId).select("wishlist");
    if (!user) return false;
    return user.wishlist?.includes(productId) || false;
  }

  /**
   * Clear entire wishlist
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Confirmation message
   */
  async clearWishlist(userId) {
    await User.findByIdAndUpdate(userId, { wishlist: [] });
    return { message: "Wishlist cleared successfully" };
  }

  /**
   * Get wishlist count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of items in wishlist
   */
  async getWishlistCount(userId) {
    const user = await User.findById(userId).select("wishlist");
    return user?.wishlist?.length || 0;
  }

  /**
   * Check multiple products in wishlist
   * @param {string} userId - User ID
   * @param {string[]} productIds - Array of product IDs
   * @returns {Promise<Object>} Map of productId to boolean
   */
  async checkMultipleInWishlist(userId, productIds) {
    const user = await User.findById(userId).select("wishlist");
    if (!user) return {};

    const wishlistSet = new Set(user.wishlist?.map((id) => id.toString()) || []);
    const result = {};
    productIds.forEach((id) => {
      result[id] = wishlistSet.has(id.toString());
    });
    return result;
  }
}

module.exports = new WishlistService();
