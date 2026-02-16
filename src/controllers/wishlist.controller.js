const catchAsync = require("../configs/catchAsync");
const wishlistService = require("../services/wishlist.service");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

const getAuthenticatedUserId = (req) => req.user?.userId || req.user?._id;

const WishlistController = {
  /**
   * Get wishlist
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getWishlist: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { page, limit } = req.query;

    const result = await wishlistService.getWishlist(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });

    return sendSuccess(res, result, "Wishlist retrieved successfully");
  }),

  /**
   * Add to wishlist
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  addToWishlist: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { productId } = req.params;

    const result = await wishlistService.addToWishlist(userId, productId);
    return sendSuccess(res, result, "Product added to wishlist", StatusCodes.CREATED);
  }),

  /**
   * Remove from wishlist
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  removeFromWishlist: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { productId } = req.params;

    const result = await wishlistService.removeFromWishlist(userId, productId);
    return sendSuccess(res, result, "Product removed from wishlist");
  }),

  /**
   * Check in wishlist
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  checkInWishlist: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { productId } = req.params;

    const isInWishlist = await wishlistService.isInWishlist(userId, productId);
    return sendSuccess(res, { isInWishlist }, "Check completed");
  }),

  /**
   * Clear wishlist
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  clearWishlist: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);

    const result = await wishlistService.clearWishlist(userId);
    return sendSuccess(res, result, "Wishlist cleared");
  }),

  /**
   * Get wishlist count
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getWishlistCount: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);

    const count = await wishlistService.getWishlistCount(userId);
    return sendSuccess(res, { count }, "Count retrieved");
  }),

  /**
   * Check multiple
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  checkMultiple: catchAsync(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return sendFail(res, "productIds array is required", StatusCodes.BAD_REQUEST);
    }

    const result = await wishlistService.checkMultipleInWishlist(userId, productIds);
    return sendSuccess(res, result, "Check completed");
  }),
};

module.exports = WishlistController;
