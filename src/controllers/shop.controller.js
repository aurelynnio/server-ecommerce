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
   * @access Private (Admin only)
   */
  getAllShops: catchAsync(async (req, res) => {
    const { page, limit, status, search, sort } = req.query;
    const result = await shopService.getAllShops({
      page,
      limit,
      status,
      search,
      sort,
    });
    return sendSuccess(res, result, "Get all shops success", StatusCodes.OK);
  }),

  /**
   * Get public shops list (only active shops)
   * @access Public
   */
  getPublicShops: catchAsync(async (req, res) => {
    const { page, limit, search, sort } = req.query;
    const result = await shopService.getAllShops({
      page,
      limit,
      status: "active", // Only show active shops to public
      search,
      sort,
    });
    return sendSuccess(res, result, "Get shops success", StatusCodes.OK);
  }),

  /**
   * Update shop status (Admin)
   * @access Private (Admin only)
   */
  updateShopStatus: catchAsync(async (req, res) => {
    const { shopId } = req.params;
    const { status } = req.body;
    const shop = await shopService.updateShopStatus(shopId, status);
    return sendSuccess(res, shop, "Shop status updated", StatusCodes.OK);
  }),

  /**
   * Register a new shop (become a seller)
   * @access Private (Authenticated users)
   */
  createShop: catchAsync(async (req, res) => {
    const newShop = await shopService.createShop(req.user.userId, req.body);
    return sendSuccess(
      res,
      newShop,
      "Shop registered successfully",
      StatusCodes.CREATED,
    );
  }),

  /**
   * Get shop information by ID
   * @access Public
   */
  getShopInfo: catchAsync(async (req, res) => {
    const shop = await shopService.getShopInfo(req.params.shopId);
    return sendSuccess(res, shop, "Get shop info success", StatusCodes.OK);
  }),

  /**
   * Get shop information by slug
   * @access Public
   */
  getShopBySlug: catchAsync(async (req, res) => {
    const shop = await shopService.getShopBySlug(req.params.slug);
    return sendSuccess(res, shop, "Get shop info success", StatusCodes.OK);
  }),

  /**
   * Get current user's shop information
   * @access Private (Seller only)
   */
  getMyShop: catchAsync(async (req, res) => {
    const shop = await shopService.getMyShop(req.user.userId);
    return sendSuccess(res, shop, "Get my shop success", StatusCodes.OK);
  }),

  /**
   * Update current user's shop information
   * @access Private (Seller only)
   */
  updateShop: catchAsync(async (req, res) => {
    const updatedShop = await shopService.updateShop(req.user.userId, req.body);
    return sendSuccess(res, updatedShop, "Update shop success", StatusCodes.OK);
  }),

  /**
   * Get shop statistics for seller dashboard
   * @access Private (Seller or Admin)
   */
  getShopStatistics: catchAsync(async (req, res) => {
    const statistics = await shopService.getShopStatistics(req.user.userId);
    return sendSuccess(
      res,
      statistics,
      "Get shop statistics success",
      StatusCodes.OK,
    );
  }),

  /**
   * Upload shop image (logo or banner)
   * @access Private (Seller or Admin)
   */
  uploadImage: catchAsync(async (req, res) => {
    const file = req.file;
    const { type } = req.body;

    if (!file) {
      return sendFail(res, "No file uploaded", StatusCodes.BAD_REQUEST);
    }

    if (!type || !["logo", "banner"].includes(type)) {
      return sendFail(
        res,
        "Invalid image type. Must be 'logo' or 'banner'",
        StatusCodes.BAD_REQUEST,
      );
    }

    const folder = type === "logo" ? "shop-logos" : "shop-banners";
    const result = await uploadImage(file.buffer, folder);

    if (!result) {
      return sendFail(
        res,
        "Image upload failed",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return sendSuccess(
      res,
      { url: result.secure_url, type },
      "Image uploaded successfully",
      StatusCodes.OK,
    );
  }),
};

module.exports = ShopController;
