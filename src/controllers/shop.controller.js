const shopService = require("../services/shop.service");
const catchAsync = require("../configs/catchAsync");
const { sendSuccess } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Shop Controller
 * Handles shop registration, retrieval, and management operations
 */
const ShopController = {
  /**
   * Register a new shop (become a seller)
   * @route POST /api/shops/register
   * @access Private (Authenticated users)
   * @body {string} name - Shop name
   * @body {string} [description] - Shop description
   * @body {string} [logo] - Shop logo URL
   * @body {string} [address] - Shop address
   * @body {string} [phone] - Shop phone number
   * @body {string} [email] - Shop email
   * @returns {Object} Created shop object
   */
  createShop: catchAsync(async (req, res) => {
    const newShop = await shopService.createShop(req.user.userId, req.body);
    return sendSuccess(
      res,
      newShop,
      "Shop registered successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get shop information by ID
   * @route GET /api/shops/:shopId
   * @access Public
   * @param {string} shopId - Shop ID
   * @returns {Object} Shop information
   */
  getShopInfo: catchAsync(async (req, res) => {
    const shop = await shopService.getShopInfo(req.params.shopId);
    return sendSuccess(res, shop, "Get shop info success", StatusCodes.OK);
  }),

  /**
   * Get current user's shop information
   * @route GET /api/shops/me
   * @access Private (Seller only)
   * @returns {Object} Current user's shop information
   */
  getMyShop: catchAsync(async (req, res) => {
    const shop = await shopService.getMyShop(req.user.userId);
    return sendSuccess(res, shop, "Get my shop success", StatusCodes.OK);
  }),

  /**
   * Update current user's shop information
   * @route PUT /api/shops
   * @access Private (Seller only)
   * @body {string} [name] - Updated shop name
   * @body {string} [description] - Updated description
   * @body {string} [logo] - Updated logo URL
   * @body {string} [address] - Updated address
   * @body {string} [phone] - Updated phone
   * @body {string} [email] - Updated email
   * @body {boolean} [isActive] - Shop active status
   * @returns {Object} Updated shop object
   */
  updateShop: catchAsync(async (req, res) => {
    const updatedShop = await shopService.updateShop(req.user.userId, req.body);
    return sendSuccess(res, updatedShop, "Update shop success", StatusCodes.OK);
  }),
};

module.exports = ShopController;
