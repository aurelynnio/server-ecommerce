const Review = require("../repositories/review.repository");
const Product = require("../repositories/product.repository");
const Order = require("../repositories/order.repository");
const Shop = require("../repositories/shop.repository");
const {
  getPaginationParams,
  buildPaginationResponse,
} = require("../utils/pagination");
const redisService = require("./redis.service");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

/**
 * Service handling product reviews

 * Manages review creation and retrieval
 */
class ReviewService {
  /**
   * Create a new review for a product
   * @param {string} userId - ID of the user creating the review
   * @param {Object} reviewData - Review details
   * @param {string} reviewData.productId - ID of the product being reviewed
   * @param {number} reviewData.rating - Rating value (1-5)
   * @param {string} [reviewData.comment] - Review comment
   * @returns {Promise<Object>} Created review object
   * @throws {Error} If product not found, not purchased, or already reviewed
   */
  async createReview(userId, reviewData) {
    const { productId, rating, comment } = reviewData;

    // Check if product exists
    const productExists = await Product.findById(productId);
    if (!productExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    // Check if user has purchased this product
    const hasPurchased = await Order.existsDeliveredOrderForProductByUser(
      userId,
      productId,
    );

    if (!hasPurchased) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You can only review products you have purchased and received",
      );
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findByUserAndProduct(userId, productId);

    if (existingReview) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "You have already reviewed this product",
      );
    }

    // Create review
    const review = await Review.create({
      user: userId,
      product: productId,
      rating,
      comment,
    });

    // Update product average rating
    await this.updateProductRating(productId);

    // Populate user info
    await review.populate("user", "username email");

    return review;
  }

  /**
   * Get all reviews for a specific product
   * @param {string} productId - Product ID
   * @param {Object} filters - Filter and sort options
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=10] - Items per page
   * @param {number} [filters.rating] - Filter by specific rating
   * @param {string} [filters.sort="newest"] - Sort order (newest, oldest, highest, lowest)
   * @returns {Promise<Object>} List of reviews with pagination
   * @throws {Error} If product not found
   */
  async getProductReviews(productId, filters = {}) {
    const { page = 1, limit = 10, rating, sort = "newest" } = filters;

    // Check if product exists
    const productExists = await Product.findById(productId);
    if (!productExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    // Determine sort order
    let sortOption = {};
    switch (sort) {
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "highest":
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case "lowest":
        sortOption = { rating: 1, createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    // Count total items first
    const total = await Review.countByProductWithFilters(productId, { rating });

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    // Execute query
    const reviews = await Review.findByProductWithFilters(productId, {
      rating,
      sort: sortOption,
      skip: paginationParams.skip,
      limit: paginationParams.limit,
    });

    // PERFORMANCE FIX: Cache rating distribution for 5 minutes
    const distributionCacheKey = `reviews:distribution:${productId}`;
    let distribution = await redisService.get(distributionCacheKey);

    if (!distribution) {
      // Calculate rating distribution
      const ratingDistribution = await Review.aggregateRatingDistributionByProduct(
        productExists._id,
      );

      distribution = {};
      for (let i = 1; i <= 5; i++) {
        distribution[i] = 0;
      }
      ratingDistribution.forEach((item) => {
        distribution[item._id] = item.count;
      });

      // Cache for 5 minutes
      await redisService.set(distributionCacheKey, distribution, 300);
    }

    return {
      ...buildPaginationResponse(reviews, paginationParams),
      metadata: {
        ratingDistribution: distribution,
        averageRating: productExists.averageRating || 0,
        totalReviews: total,
      },
    };
  }

  /**
   * Get all reviews with filters (Admin)
   */
  async getAllReviews(filters = {}) {
    const { page = 1, limit = 10, rating, sort = "newest", search } = filters;

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "highest") sortOption = { rating: -1 };
    if (sort === "lowest") sortOption = { rating: 1 };

    const total = await Review.countWithFilters({ rating, search });
    const paginationParams = getPaginationParams(page, limit, total);

    const reviews = await Review.findWithFilters(
      { rating, search },
      {
        sort: sortOption,
        skip: paginationParams.skip,
        limit: paginationParams.limit,
      },
    );

    return buildPaginationResponse(reviews, paginationParams);
  }

  /**
   * Get reviews created by a user
   * @param {string} userId - User ID
   * @param {Object} filters - Pagination options
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=10] - Items per page
   * @returns {Promise<Object>} Reviews with pagination
   */
  async getUserReviews(userId, filters = {}) {
    const { page = 1, limit = 10 } = filters;

    // Count total items first
    const total = await Review.countByUserId(userId);

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    // Execute query
    const reviews = await Review.findByUserIdWithPagination(
      userId,
      paginationParams,
    );

    return buildPaginationResponse(reviews, paginationParams);
  }

  /**
   * Get single review by ID
   * @param {string} reviewId - Review ID
   * @returns {Promise<Object>} Review with user and product info
   * @throws {Error} If review not found
   */
  async getReviewById(reviewId) {
    const review = await Review.findByIdWithUserAndProduct(reviewId);

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    return review;
  }

  /**
   * Update review content or rating
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update payload
   * @param {number} [updateData.rating] - Rating value (1-5)
   * @param {string} [updateData.comment] - Review comment
   * @returns {Promise<Object>} Updated review
   * @throws {Error} If review not found or user unauthorized
   */
  async updateReview(reviewId, userId, updateData) {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    // Check if user owns this review
    if (review.user.toString() !== userId) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized to update this review",
      );
    }

    // Update review
    if (updateData.rating !== undefined) {
      review.rating = updateData.rating;
    }
    if (updateData.comment !== undefined) {
      review.comment = updateData.comment;
    }

    await review.save();

    // Update product average rating if rating changed
    if (updateData.rating !== undefined) {
      await this.updateProductRating(review.product);
    }

    await review.populate("user", "username email");

    return review;
  }

  /**
   * Delete review
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID
   * @param {boolean} [isAdmin=false] - Allow admin deletion
   * @returns {Promise<{ message: string }>} Deletion result
   * @throws {Error} If review not found or user unauthorized
   */
  async deleteReview(reviewId, userId, isAdmin = false) {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    // Check permission: user can only delete their own reviews unless admin
    if (!isAdmin && review.user.toString() !== userId) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized to delete this review",
      );
    }

    const productId = review.product;

    await Review.deleteById(reviewId);

    // Update product average rating
    await this.updateProductRating(productId);

    return { message: "Review deleted successfully" };
  }

  /**
   * Update product average rating and total reviews
   * @param {string} productId - Product ID
   * @returns {Promise<{ averageRating: number, totalReviews: number }>}
   */
  async updateProductRating(productId) {
    const stats = await Review.aggregateProductRatingStats(productId);

    const product = await Product.findById(productId);
    if (product) {
      if (stats.length > 0) {
        product.averageRating = Math.round(stats[0].averageRating * 10) / 10; // Round to 1 decimal
        product.totalReviews = stats[0].totalReviews;
      } else {
        product.averageRating = 0;
        product.totalReviews = 0;
      }
      await product.save();
    }

    return stats.length > 0 ? stats[0] : { averageRating: 0, totalReviews: 0 };
  }

  /**
   * Check if user can review a product
   * @param {string} userId - User ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Eligibility result
   */
  async canUserReview(userId, productId) {
    // Check if product exists
    const productExists = await Product.findById(productId);
    if (!productExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    // Check if user has purchased and received this product
    const hasPurchased = await Order.existsDeliveredOrderForProductByUser(
      userId,
      productId,
    );

    if (!hasPurchased) {
      return {
        canReview: false,
        reason: "You must purchase and receive this product first",
      };
    }

    // Check if user already reviewed
    const existingReview = await Review.findByUserAndProduct(userId, productId);

    if (existingReview) {
      return {
        canReview: false,
        reason: "You have already reviewed this product",
        existingReview,
      };
    }

    return { canReview: true };
  }

  /**
   * Get reviews for a specific shop
   * @param {string} userId - Shop owner user ID
   * @param {Object} filters - Filter and pagination options
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=10] - Items per page
   * @param {number} [filters.rating] - Filter by rating
   * @param {string} [filters.replyStatus] - "replied" or "unreplied"
   * @param {string} [filters.search] - Search term
   * @returns {Promise<Object>} Reviews with pagination
   */
  async getShopReviews(userId, filters = {}) {
    // 1. Find the shop owned by this user
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found for this user");
    }

    // 2. Find all products belonging to this shop
    const products = await Product.findByShopIdSelectIds(shop._id);
    const productIds = products.map((p) => p._id);

    // 3. Query reviews for these products
    const { page = 1, limit = 10, rating, replyStatus, search } = filters;

    const filterArgs = { rating, replyStatus, search };
    const total = await Review.countByProductIdsWithFilters(productIds, filterArgs);
    const paginationParams = getPaginationParams(page, limit, total);

    const reviews = await Review.findByProductIdsWithFilters(
      productIds,
      filterArgs,
      paginationParams,
    );

    return buildPaginationResponse(reviews, paginationParams);
  }

  /**
   * Reply to a review (shop owner only)
   * @param {string} userId - Shop owner user ID
   * @param {string} reviewId - Review ID
   * @param {string} content - Reply content
   * @returns {Promise<Object>} Updated review
   * @throws {Error} If review or shop not found, or unauthorized
   */
  async replyReview(userId, reviewId, content) {
    if (!content || !content.trim()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Reply content is required");
    }

    const review = await Review.findByIdWithProduct(reviewId);
    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    // Check if user owns the shop that owns the product
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }

    // Verify product belongs to shop (assuming product has shop field populated or id)
    // If product.shop is ObjectId
    const productShopId = review.product.shop.toString();

    if (productShopId !== shop._id.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized: Product does not belong to your shop",
      );
    }

    // Update review with reply
    review.reply = content;
    review.replyAt = new Date();
    await review.save();

    return review;
  }

  /**
   * Get review statistics (Admin)
   * @returns {Promise<Object>} Review statistics summary
   */
  async getReviewStatistics() {
    const totalReviews = await Review.countAll();

    const ratingDistribution = await Review.aggregateOverallRatingDistribution();

    const averageRating = await Review.aggregateOverallAverageRating();

    // Top rated products
    const topRatedProducts = await Product.findTopRatedProducts(5);

    // Most reviewed products
    const mostReviewedProducts = await Product.findMostReviewedProducts(5);

    return {
      totalReviews,
      averageRating:
        averageRating.length > 0
          ? Math.round(averageRating[0].average * 10) / 10
          : 0,
      ratingDistribution,
      topRatedProducts,
      mostReviewedProducts,
    };
  }
}

module.exports = new ReviewService();


