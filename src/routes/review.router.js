
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
* @desc Get all reviews for a specific product
* @accessPublic
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
* @desc Get a single review by ID
* @accessPublic
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
* @desc Create a new review for a product
* @accessPrivate (Authenticated users - must have purchased product)
 * @body    { productId, rating, comment, images? }
 */

router.post(
  "/",
  verifyAccessToken,
  validate(createReviewValidator),
  reviewController.createReview
);
/**
* @desc Get current user's reviews
* @accessPrivate (Authenticated users)
 * @query   page, limit
 */

router.get(
  "/user/me",
  verifyAccessToken,
  validate({ query: getReviewsQueryValidator }),
  reviewController.getUserReviews
);
/**
* @desc Check if current user can review a product
* @accessPrivate (Authenticated users)
 * @param   productId - Product ID to check
 */

router.get(
  "/check/:productId",
  verifyAccessToken,
  validate({ params: productIdParamValidator }),
  reviewController.canUserReview
);
/**
* @desc Update an existing review
* @accessPrivate (Authenticated users - own review only)
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
* @desc Delete a review
* @accessPrivate (Owner or Admin)
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
 * @desc    Get all reviews (Admin)
 * @access  Private (Admin)
 */
router.get(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: getReviewsQueryValidator }),
  reviewController.getAllReviews
);

/**
 * @desc Get review statistics overview
 * @accessPrivate (Admin only)
 */


router.get(
  "/statistics/overview",
  verifyAccessToken,
  requireRole("admin"),
  reviewController.getReviewStatistics
);

module.exports = router;
