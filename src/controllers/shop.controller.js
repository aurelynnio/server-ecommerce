const shopService = require("../services/shop.service");
const catchAsync = require("../configs/catchAsync");
const { uploadImage } = require("../configs/cloudinary");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Shop Controller
 * Handles shop registration, retrieval, and management operations
 */
const ShopController = {
  /**
   * Get all shops (Admin)
   * @route GET /api/shops/admin/all
   * @access Private (Admin only)
   * @query {number} page - Page number
   * @query {number} limit - Items per page
   * @query {string} status - Filter by status
   * @query {string} search - Search by name
   * @returns {Object} Shops with pagination
   */
  getAllShops: catchAsync(async (req, res) => {
    const { page, limit, status, search, sort } = req.query;
    const result = await shopService.getAllShops({ page, limit, status, search, sort });
    return sendSuccess(res, result, "Get all shops success", StatusCodes.OK);
  }),

  /**
   * Update shop status (Admin)
   * @route PUT /api/shops/admin/:shopId/status
   * @access Private (Admin only)
   * @param {string} shopId - Shop ID
   * @body {string} status - New status
   * @returns {Object} Updated shop
   */
  updateShopStatus: catchAsync(async (req, res) => {
    const { shopId } = req.params;
    const { status } = req.body;
    const shop = await shopService.updateShopStatus(shopId, status);
    return sendSuccess(res, shop, "Shop status updated", StatusCodes.OK);
  }),

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
   * Get shop information by slug
   * @route GET /api/shops/slug/:slug
   * @access Public
   * @param {string} slug - Shop slug
   * @returns {Object} Shop information
   */
  getShopBySlug: catchAsync(async (req, res) => {
    const shop = await shopService.getShopBySlug(req.params.slug);
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

  /**
   * Upload shop image (logo or banner)
   * @route POST /api/shops/upload-image
   * @access Private (Seller or Admin)
   * @body {string} type - Image type ("logo" or "banner")
   * @files {File} image - Image file
   * @returns {Object} Uploaded image URL
   */
  uploadImage: catchAsync(async (req, res) => {
    const file = req.file;
    const { type } = req.body;

    if (!file) {
      return sendFail(res, "No file uploaded", StatusCodes.BAD_REQUEST);
    }

    if (!type || !["logo", "banner"].includes(type)) {
      return sendFail(res, "Invalid image type. Must be 'logo' or 'banner'", StatusCodes.BAD_REQUEST);
    }

    const folder = type === "logo" ? "shop-logos" : "shop-banners";
    const result = await uploadImage(file.buffer, folder);

    if (!result) {
      return sendFail(res, "Image upload failed", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return sendSuccess(
      res,
      { url: result.secure_url, type },
      "Image uploaded successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = ShopController;
