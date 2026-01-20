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

* @access  Private (Authenticated users - must have purchased product)





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

* @access  Public






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

* @access  Private (Authenticated users)



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

* @access  Public


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

* @access  Private (Owner only)





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

* @access  Private (Owner or Admin)


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

* @access  Private (Authenticated users)


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
   * Get all reviews (Admin)
   * @access  Private (Admin)
   */
  getAllReviews: catchAsync(async (req, res) => {
    const result = await reviewService.getAllReviews(req.query);

    return sendSuccess(
      res,
      result,
      "All reviews retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get review statistics overview

* @access  Private (Admin only)

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
