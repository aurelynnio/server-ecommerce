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

// Public routes (no authentication required)
router.get(
  "/product/:productId",
  validate({
    params: productIdParamValidator,
    query: getReviewsQueryValidator,
  }),
  reviewController.getProductReviews
);
router.get(
  "/:reviewId",
  validate({ params: reviewIdParamValidator }),
  reviewController.getReviewById
);

// User routes (require authentication)
router.post(
  "/",
  verifyAccessToken,
  validate(createReviewValidator),
  reviewController.createReview
);
router.get(
  "/user/me",
  verifyAccessToken,
  validate({ query: getReviewsQueryValidator }),
  reviewController.getUserReviews
);
router.get(
  "/check/:productId",
  verifyAccessToken,
  validate({ params: productIdParamValidator }),
  reviewController.canUserReview
);
router.put(
  "/:reviewId",
  verifyAccessToken,
  validate({
    params: reviewIdParamValidator,
    body: updateReviewValidator,
  }),
  reviewController.updateReview
);
router.delete(
  "/:reviewId",
  verifyAccessToken,
  validate({ params: reviewIdParamValidator }),
  reviewController.deleteReview
);

// Admin routes (require admin role)
router.get(
  "/statistics/overview",
  verifyAccessToken,
  requireRole("admin"),
  reviewController.getReviewStatistics
);

module.exports = router;

