const catchAsync = require("../configs/catchAsync");
const wishlistService = require("../services/wishlist.service");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

const WishlistController = {
  /**
   * Get user's wishlist

   */
  getWishlist: catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { page, limit } = req.query;

    const result = await wishlistService.getWishlist(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    });

    return sendSuccess(res, result, "Wishlist retrieved successfully");
  }),

  /**
   * Add product to wishlist

   */
  addToWishlist: catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { productId } = req.params;

    const result = await wishlistService.addToWishlist(userId, productId);
    return sendSuccess(res, result, "Product added to wishlist", StatusCodes.CREATED);
  }),

  /**
   * Remove product from wishlist

   */
  removeFromWishlist: catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { productId } = req.params;

    const result = await wishlistService.removeFromWishlist(userId, productId);
    return sendSuccess(res, result, "Product removed from wishlist");
  }),

  /**
   * Check if product is in wishlist

   */
  checkInWishlist: catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { productId } = req.params;

    const isInWishlist = await wishlistService.isInWishlist(userId, productId);
    return sendSuccess(res, { isInWishlist }, "Check completed");
  }),

  /**
   * Clear entire wishlist

   */
  clearWishlist: catchAsync(async (req, res) => {
    const userId = req.user._id;

    const result = await wishlistService.clearWishlist(userId);
    return sendSuccess(res, result, "Wishlist cleared");
  }),

  /**
   * Get wishlist count

   */
  getWishlistCount: catchAsync(async (req, res) => {
    const userId = req.user._id;

    const count = await wishlistService.getWishlistCount(userId);
    return sendSuccess(res, { count }, "Count retrieved");
  }),

  /**
   * Check multiple products in wishlist

   */
  checkMultiple: catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds)) {
      return sendFail(res, "productIds array is required", StatusCodes.BAD_REQUEST);
    }

    const result = await wishlistService.checkMultipleInWishlist(userId, productIds);
    return sendSuccess(res, result, "Check completed");
  }),
};

module.exports = WishlistController;
