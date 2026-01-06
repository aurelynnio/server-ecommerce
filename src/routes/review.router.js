const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  productIdParamValidator,
  getReviewsQueryValidator,
} = require("../validations/review.validator");

/**
 * Public Routes
 */

/**
 * @route   GET /api/reviews/product/:productId
 * @desc    Get all reviews for a specific product
 * @access  Public
 * @param   productId - Product ID to get reviews for
 * @query   page, limit, rating, sort
 */
router.get(
  "/product/:productId",
  validate({
    params: productIdParamValidator,
    query: getReviewsQueryValidator,
  }),
  reviewController.getProductReviews
);

/**
 * @route   GET /api/reviews/:reviewId
 * @desc    Get a single review by ID
 * @access  Public
 * @param   reviewId - Review ID
 */
router.get(
  "/:reviewId",
  validate({ params: reviewIdParamValidator }),
  reviewController.getReviewById
);

/**
 * User Routes (Authenticated)
 */

/**
 * @route   POST /api/reviews
 * @desc    Create a new review for a product
 * @access  Private (Authenticated users - must have purchased product)
 * @body    { productId, rating, comment, images? }
 */
router.post(
  "/",
  verifyAccessToken,
  validate(createReviewValidator),
  reviewController.createReview
);

/**
 * @route   GET /api/reviews/user/me
 * @desc    Get current user's reviews
 * @access  Private (Authenticated users)
 * @query   page, limit
 */
router.get(
  "/user/me",
  verifyAccessToken,
  validate({ query: getReviewsQueryValidator }),
  reviewController.getUserReviews
);

/**
 * @route   GET /api/reviews/check/:productId
 * @desc    Check if current user can review a product
 * @access  Private (Authenticated users)
 * @param   productId - Product ID to check
 */
router.get(
  "/check/:productId",
  verifyAccessToken,
  validate({ params: productIdParamValidator }),
  reviewController.canUserReview
);

/**
 * @route   PUT /api/reviews/:reviewId
 * @desc    Update an existing review
 * @access  Private (Authenticated users - own review only)
 * @param   reviewId - Review ID to update
 * @body    { rating?, comment?, images? }
 */
router.put(
  "/:reviewId",
  verifyAccessToken,
  validate({
    params: reviewIdParamValidator,
    body: updateReviewValidator,
  }),
  reviewController.updateReview
);

/**
 * @route   DELETE /api/reviews/:reviewId
 * @desc    Delete a review
 * @access  Private (Owner or Admin)
 * @param   reviewId - Review ID to delete
 */
router.delete(
  "/:reviewId",
  verifyAccessToken,
  validate({ params: reviewIdParamValidator }),
  reviewController.deleteReview
);

/**
 * Admin Routes
 */

/**
 * @route   GET /api/reviews/statistics/overview
 * @desc    Get review statistics overview
 * @access  Private (Admin only)
 */
router.get(
  "/statistics/overview",
  verifyAccessToken,
  requireRole("admin"),
  reviewController.getReviewStatistics
);

module.exports = router;

