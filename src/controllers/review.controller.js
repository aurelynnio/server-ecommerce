const catchAsync = require('../configs/catchAsync');
const reviewService = require('../services/review.service');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess } = require('../shared/res/formatResponse');

const ReviewController = {
  /**
   * Create review
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const review = await reviewService.createReview(userId, req.body);

    return sendSuccess(res, review, 'Review created successfully', StatusCodes.CREATED);
  }),

  /**
   * Get product reviews
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getProductReviews: catchAsync(async (req, res) => {
    const result = await reviewService.getProductReviews(req.params.productId, req.query);

    return sendSuccess(res, result, 'Product reviews retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get user reviews
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getUserReviews: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await reviewService.getUserReviews(userId, req.query);

    return sendSuccess(res, result, 'User reviews retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get review by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getReviewById: catchAsync(async (req, res) => {
    const review = await reviewService.getReviewById(req.params.reviewId);

    return sendSuccess(res, review, 'Review retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Update review
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const review = await reviewService.updateReview(req.params.reviewId, userId, req.body);

    return sendSuccess(res, review, 'Review updated successfully', StatusCodes.OK);
  }),

  /**
   * Delete review
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';
    const result = await reviewService.deleteReview(req.params.reviewId, userId, isAdmin);

    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  /**
   * Can user review
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  canUserReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await reviewService.canUserReview(userId, req.params.productId);

    return sendSuccess(res, result, 'Review eligibility checked', StatusCodes.OK);
  }),

  /**
   * Get all reviews
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getAllReviews: catchAsync(async (req, res) => {
    const result = await reviewService.getAllReviews(req.query);

    return sendSuccess(res, result, 'All reviews retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get shop reviews
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getShopReviews: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await reviewService.getShopReviews(userId, req.query);

    return sendSuccess(res, result, 'Shop reviews retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Reply review
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  replyReview: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const { reviewId } = req.params;
    const { content } = req.body;

    const result = await reviewService.replyReview(userId, reviewId, content);

    return sendSuccess(res, result, 'Replied to review successfully', StatusCodes.OK);
  }),

  /**
   * Get review statistics
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getReviewStatistics: catchAsync(async (req, res) => {
    const stats = await reviewService.getReviewStatistics();

    return sendSuccess(res, stats, 'Review statistics retrieved successfully', StatusCodes.OK);
  }),
};

module.exports = ReviewController;
