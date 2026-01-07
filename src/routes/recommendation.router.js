const express = require("express");
const router = express.Router();
const recommendationController = require("../controllers/recommendation.controller");
const { optionalAuth } = require("../middlewares/auth.middleware");

// All routes use optional authentication for personalization
router.use(optionalAuth);

// Get personalized recommendations ("Guess You Like")
router.get("/for-you", recommendationController.getForYou);

// Get homepage recommendations
router.get("/homepage", recommendationController.getHomepage);

// Get recently viewed products
router.get("/recently-viewed", recommendationController.getRecentlyViewed);

// Track product view
router.post("/track-view/:productId", recommendationController.trackView);

// Get frequently bought together
router.get("/fbt/:productId", recommendationController.getFrequentlyBoughtTogether);

// Get similar products
router.get("/similar/:productId", recommendationController.getSimilar);

// Get category recommendations
router.get("/category/:categoryId", recommendationController.getCategoryRecommendations);

module.exports = router;
