const catchAsync = require("../configs/catchAsync");
const recommendationService = require("../services/recommendation.service");
const { sendSuccess } = require("../shared/res/formatResponse");

/**
 * Recommendation Controller
 * Handles product recommendation operations
 */
const RecommendationController = {
  /**
   * Get personalized recommendations ("Guess You Like")
   * @access Public (personalized if authenticated)
   */
  getForYou: catchAsync(async (req, res) => {
    const userId = req.user?._id;
    const { limit } = req.query;

    let recommendations;
    if (userId) {
      recommendations = await recommendationService.getPersonalizedRecommendations(
        userId,
        parseInt(limit) || 20
      );
    } else {
      recommendations = await recommendationService.getGuestRecommendations(
        parseInt(limit) || 20
      );
    }

    return sendSuccess(res, recommendations, "Recommendations retrieved");
  }),

  /**
   * Get frequently bought together products
   * @access Public
   */
  getFrequentlyBoughtTogether: catchAsync(async (req, res) => {
    const { productId } = req.params;
    const { limit } = req.query;

    const products = await recommendationService.getFrequentlyBoughtTogether(
      productId,
      parseInt(limit) || 5
    );

    return sendSuccess(res, products, "FBT products retrieved");
  }),

  /**
   * Get similar products
   * @access Public
   */
  getSimilar: catchAsync(async (req, res) => {
    const { productId } = req.params;
    const { limit } = req.query;

    const products = await recommendationService.getSimilarProducts(
      productId,
      parseInt(limit) || 10
    );

    return sendSuccess(res, products, "Similar products retrieved");
  }),

  /**
   * Get recently viewed products
   * @access Private (requires authentication)
   */
  getRecentlyViewed: catchAsync(async (req, res) => {
    const userId = req.user?._id;
    const { limit } = req.query;

    if (!userId) {
      return sendSuccess(res, [], "No recently viewed products");
    }

    const products = await recommendationService.getRecentlyViewed(
      userId,
      parseInt(limit) || 10
    );

    return sendSuccess(res, products, "Recently viewed products retrieved");
  }),

  /**
   * Track product view
   * @access Public (tracks if authenticated)
   */
  trackView: catchAsync(async (req, res) => {
    const userId = req.user?._id;
    const { productId } = req.params;

    if (userId) {
      await recommendationService.trackProductView(userId, productId);
    }

    return sendSuccess(res, null, "View tracked");
  }),

  /**
   * Get category recommendations
   * @access Public
   */
  getCategoryRecommendations: catchAsync(async (req, res) => {
    const { categoryId } = req.params;
    const { limit } = req.query;

    const products = await recommendationService.getCategoryRecommendations(
      categoryId,
      parseInt(limit) || 20
    );

    return sendSuccess(res, products, "Category recommendations retrieved");
  }),

  /**
   * Get homepage recommendations
   * @access Public (personalized if authenticated)
   */
  getHomepage: catchAsync(async (req, res) => {
    const userId = req.user?._id;

    const recommendations = await recommendationService.getHomepageRecommendations(userId);

    return sendSuccess(res, recommendations, "Homepage recommendations retrieved");
  }),
};

module.exports = RecommendationController;
