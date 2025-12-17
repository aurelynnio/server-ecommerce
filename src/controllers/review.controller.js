const catchAsync = require("../configs/catchAsync");
const reviewService = require("../services/review.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");


const ReviewController = {
  // Create review (User only - must have purchased product)
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

  // Get all reviews for a product (Public)
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

  // Get user's reviews (User only)
  getUserReviews: catchAsync(async (req, res) => {
    const result = await reviewService.getUserReviews(userId, req.query);

    return sendSuccess(
      res,
      result,
      "User reviews retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get single review by ID
  getReviewById: catchAsync(async (req, res) => {
    const review = await reviewService.getReviewById(req.params.reviewId);

    return sendSuccess(
      res,
      review,
      "Review retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Update review (User only - own review)
  updateReview: catchAsync(async (req, res) => {
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

  // Delete review (User - own review, Admin - any review)
  deleteReview: catchAsync(async (req, res) => {
    const result = await reviewService.deleteReview(
      req.params.reviewId,
      userId,
      isAdmin
    );

    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  // Check if user can review product (User only)
  canUserReview: catchAsync(async (req, res) => {
    const result = await reviewService.canUserReview(userId, req.params.productId);

    return sendSuccess(
      res,
      result,
      "Review eligibility checked",
      StatusCodes.OK
    );
  }),

  // Get review statistics (Admin only)
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
