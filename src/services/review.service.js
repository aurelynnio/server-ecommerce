const Review = require("../models/review.model");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const Shop = require("../models/shop.model");
const { getPaginationParams } = require("../utils/pagination");
const cacheService = require("./cache.service");
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
    const hasPurchased = await Order.exists({
      userId,
      "products.productId": productId,
      status: "delivered",
    });

    if (!hasPurchased) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You can only review products you have purchased and received"
      );
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: userId,
      productId,
    });

    if (existingReview) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "You have already reviewed this product"
      );
    }


    // Create review
    const review = await Review.create({
      user: userId,
      productId,
      rating,
      comment,
    });

    // Update product average rating
    await this.updateProductRating(product);

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


    // Build query
    const query = { product: productId };

    if (rating) {
      query.rating = rating;
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
    const total = await Review.countDocuments(query);

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    // Execute query
    const reviews = await Review.find(query)
      .populate("user", "username email")
      .sort(sortOption)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);

    // PERFORMANCE FIX: Cache rating distribution for 5 minutes
    const distributionCacheKey = `reviews:distribution:${productId}`;
    let distribution = await cacheService.get(distributionCacheKey);

    if (!distribution) {
      // Calculate rating distribution
      const ratingDistribution = await Review.aggregate([
        { $match: { product: productExists._id } },
        {
          $group: {
            _id: "$rating",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]);

      distribution = {};
      for (let i = 1; i <= 5; i++) {
        distribution[i] = 0;
      }
      ratingDistribution.forEach((item) => {
        distribution[item._id] = item.count;
      });

      // Cache for 5 minutes
      await cacheService.set(distributionCacheKey, distribution, 300);
    }

    return {
      data: reviews,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalPages: paginationParams.totalPages,
        totalItems: paginationParams.totalItems,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
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

    const query = {};

    if (rating) {
      query.rating = rating;
    }

    if (search) {
      // Simple search by comment content
      query.comment = { $regex: search, $options: "i" };
    }

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "highest") sortOption = { rating: -1 };
    if (sort === "lowest") sortOption = { rating: 1 };

    const total = await Review.countDocuments(query);
    const paginationParams = getPaginationParams(page, limit, total);

    const reviews = await Review.find(query)
      .populate("user", "username email avatar")
      .populate("product", "name slug images")
      .sort(sortOption)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);

    return {
      data: reviews,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalPages: paginationParams.totalPages,
        totalItems: paginationParams.totalItems,
      },
    };
  }

  // Get user's reviews

  async getUserReviews(userId, filters = {}) {
    const { page = 1, limit = 10 } = filters;

    // Count total items first
    const total = await Review.countDocuments({ user: userId });

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    // Execute query
    const reviews = await Review.find({ user: userId })
      .populate("product", "name slug images")
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);

    return {
      data: reviews,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalPages: paginationParams.totalPages,
        totalItems: paginationParams.totalItems,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  // Get single review by ID
  async getReviewById(reviewId) {
    const review = await Review.findById(reviewId)
      .populate("user", "username email")
      .populate("product", "name slug images");

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }


    return review;
  }

  // Update review
  async updateReview(reviewId, userId, updateData) {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    // Check if user owns this review
    if (review.user.toString() !== userId) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized to update this review"
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

  // Delete review
  async deleteReview(reviewId, userId, isAdmin = false) {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    // Check permission: user can only delete their own reviews unless admin
    if (!isAdmin && review.user.toString() !== userId) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized to delete this review"
      );
    }


    const productId = review.product;

    await review.deleteOne();

    // Update product average rating
    await this.updateProductRating(productId);

    return { message: "Review deleted successfully" };
  }

  // Update product average rating
  async updateProductRating(productId) {
    const stats = await Review.aggregate([
      { $match: { product: productId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

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

  // Check if user can review product
  async canUserReview(userId, productId) {
    // Check if product exists
    const productExists = await Product.findById(productId);
    if (!productExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }


    // Check if user has purchased and received this product
    const hasPurchased = await Order.exists({
      userId,
      "products.productId": productId,
      status: "delivered",
    });

    if (!hasPurchased) {
      return {
        canReview: false,
        reason: "You must purchase and receive this product first",
      };
    }

    // Check if user already reviewed
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });

    if (existingReview) {
      return {
        canReview: false,
        reason: "You have already reviewed this product",
        existingReview,
      };
    }

    return { canReview: true };
  }

  // Get reviews for a specific shop
  async getShopReviews(userId, filters = {}) {
    // 1. Find the shop owned by this user
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found for this user");
    }

    // 2. Find all products belonging to this shop
    const products = await Product.find({ shop: shop._id }).select("_id");
    const productIds = products.map((p) => p._id);

    // 3. Query reviews for these products
    const { page = 1, limit = 10, rating, replyStatus, search } = filters;
    
    const query = { product: { $in: productIds } };

    if (rating) {
      query.rating = rating;
    }

    if (replyStatus === "replied") {
      query.reply = { $ne: "" };
    } else if (replyStatus === "unreplied") {
      query.reply = "";
    }

    if (search) {
      query.comment = { $regex: search, $options: "i" };
    }

    const total = await Review.countDocuments(query);
    const paginationParams = getPaginationParams(page, limit, total);

    const reviews = await Review.find(query)
      .populate("user", "username email avatar")
      .populate("product", "name slug images")
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit);

    return {
      data: reviews,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalPages: paginationParams.totalPages,
        totalItems: paginationParams.totalItems,
      },
    };
  }

  // Reply to a review (Shop owner only)
  async replyReview(userId, reviewId, content) {
    if (!content || !content.trim()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Reply content is required");
    }

    const review = await Review.findById(reviewId).populate("product");
    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    // Check if user owns the shop that owns the product
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }

    // Verify product belongs to shop (assuming product has shop field populated or id)
    // If product.shop is ObjectId
    const productShopId = review.product.shop.toString(); 
    
    if (productShopId !== shop._id.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized: Product does not belong to your shop"
      );
    }

    // Update review with reply
    review.reply = content;
    review.replyAt = new Date();
    await review.save();

    return review;
  }

  // Get review statistics (Admin)

  async getReviewStatistics() {
    const totalReviews = await Review.countDocuments();

    const ratingDistribution = await Review.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const averageRating = await Review.aggregate([
      {
        $group: {
          _id: null,
          average: { $avg: "$rating" },
        },
      },
    ]);

    // Top rated products
    const topRatedProducts = await Product.find({ totalReviews: { $gt: 0 } })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(5)
      .select("name slug averageRating totalReviews images");

    // Most reviewed products
    const mostReviewedProducts = await Product.find({
      totalReviews: { $gt: 0 },
    })
      .sort({ totalReviews: -1 })
      .limit(5)
      .select("name slug averageRating totalReviews images");

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
