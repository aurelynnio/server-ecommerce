const express = require("express");
const router = express.Router();
const recommendationController = require("../controllers/recommendation.controller");
const { optionalAuth } = require("../middlewares/auth.middleware");

// All routes use optional authentication for personalization
router.use(optionalAuth);

/**
 * @desc    Get personalized recommendations
 * @access  Public (Personalized if authenticated)
 */
router.get("/for-you", recommendationController.getForYou);

/**
 * @desc    Get homepage recommendations
 * @access  Public
 */
router.get("/homepage", recommendationController.getHomepage);

/**
 * @desc    Get recently viewed products
 * @access  Public (Personalized if authenticated)
 */
router.get("/recently-viewed", recommendationController.getRecentlyViewed);

/**
 * @desc    Track product view for recommendations
 * @access  Public (Optional auth)
 */
router.post("/track-view/:productId", recommendationController.trackView);

/**
 * @desc    Get frequently bought together products
 * @access  Public
 */
router.get("/fbt/:productId", recommendationController.getFrequentlyBoughtTogether);

/**
 * @desc    Get similar products
 * @access  Public
 */
router.get("/similar/:productId", recommendationController.getSimilar);

/**
 * @desc    Get category recommendations
 * @access  Public
 */
router.get("/category/:categoryId", recommendationController.getCategoryRecommendations);

module.exports = router;
