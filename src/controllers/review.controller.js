const catchAsync = require("../configs/catchAsync");
const reviewService = require("../services/review.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Review Controller
 * Handles product review operations including CRUD, statistics, and eligibility checks
 */
const ReviewController = {
  /**
   * Create a new review for a product
   * @route POST /api/reviews
   * @access Private (Authenticated users - must have purchased product)
   * @body {string} productId - Product ID to review
   * @body {number} rating - Rating (1-5)
   * @body {string} comment - Review comment
   * @body {Array} [images] - Review images
   * @returns {Object} Created review object
   */
  createReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const review = await reviewService.createReview(userId, req.body);

    return sendSuccess(
      res,
      review,
      "Review created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get all reviews for a specific product
   * @route GET /api/reviews/product/:productId
   * @access Public
   * @param {string} productId - Product ID
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @query {number} [rating] - Filter by rating
   * @query {string} [sort] - Sort order
   * @returns {Object} Reviews with pagination metadata
   */
  getProductReviews: catchAsync(async (req, res) => {
    const result = await reviewService.getProductReviews(
      req.params.productId,
      req.query
    );

    return sendSuccess(
      res,
      result,
      "Product reviews retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get current user's reviews
   * @route GET /api/reviews/user/me
   * @access Private (Authenticated users)
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @returns {Object} User's reviews with pagination
   */
  getUserReviews: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await reviewService.getUserReviews(userId, req.query);

    return sendSuccess(
      res,
      result,
      "User reviews retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get a single review by ID
   * @route GET /api/reviews/:reviewId
   * @access Public
   * @param {string} reviewId - Review ID
   * @returns {Object} Review object
   */
  getReviewById: catchAsync(async (req, res) => {
    const review = await reviewService.getReviewById(req.params.reviewId);

    return sendSuccess(
      res,
      review,
      "Review retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update an existing review
   * @route PUT /api/reviews/:reviewId
   * @access Private (Owner only)
   * @param {string} reviewId - Review ID to update
   * @body {number} [rating] - Updated rating
   * @body {string} [comment] - Updated comment
   * @body {Array} [images] - Updated images
   * @returns {Object} Updated review object
   */
  updateReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const review = await reviewService.updateReview(
      req.params.reviewId,
      userId,
      req.body
    );

    return sendSuccess(
      res,
      review,
      "Review updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Delete a review
   * @route DELETE /api/reviews/:reviewId
   * @access Private (Owner or Admin)
   * @param {string} reviewId - Review ID to delete
   * @returns {Object} Deletion confirmation
   */
  deleteReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === "admin";
    const result = await reviewService.deleteReview(
      req.params.reviewId,
      userId,
      isAdmin
    );

    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  /**
   * Check if current user can review a product
   * @route GET /api/reviews/check/:productId
   * @access Private (Authenticated users)
   * @param {string} productId - Product ID to check
   * @returns {Object} Eligibility status { canReview: boolean, reason?: string }
   */
  canUserReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await reviewService.canUserReview(userId, req.params.productId);

    return sendSuccess(
      res,
      result,
      "Review eligibility checked",
      StatusCodes.OK
    );
  }),

  /**
   * Get review statistics overview
   * @route GET /api/reviews/statistics/overview
   * @access Private (Admin only)
   * @returns {Object} Review statistics (total, average rating, distribution, etc.)
   */
  getReviewStatistics: catchAsync(async (req, res) => {
    const stats = await reviewService.getReviewStatistics();

    return sendSuccess(
      res,
      stats,
      "Review statistics retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = ReviewController;
