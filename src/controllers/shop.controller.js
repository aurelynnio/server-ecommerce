const shopService = require('../services/shop.service');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const ShopController = {
  /**
   * Get all shops
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
    return sendSuccess(res, result, 'Get all shops success', StatusCodes.OK);
  }),

  /**
   * Get public shops
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getPublicShops: catchAsync(async (req, res) => {
    const { page, limit, search, sort } = req.query;
    const result = await shopService.getAllShops({
      page,
      limit,
      status: 'active',
      search,
      sort,
    });
    return sendSuccess(res, result, 'Get shops success', StatusCodes.OK);
  }),

  /**
   * Update shop status
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateShopStatus: catchAsync(async (req, res) => {
    const { shopId } = req.params;
    const { status } = req.body;
    const shop = await shopService.updateShopStatus(shopId, status);
    return sendSuccess(res, shop, 'Shop status updated', StatusCodes.OK);
  }),

  /**
   * Create shop
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createShop: catchAsync(async (req, res) => {
    const newShop = await shopService.createShop(req.user.userId, req.body);
    return sendSuccess(res, newShop, 'Shop registered successfully', StatusCodes.CREATED);
  }),

  /**
   * Get shop info
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getShopInfo: catchAsync(async (req, res) => {
    const shop = await shopService.getShopInfo(req.params.shopId);
    return sendSuccess(res, shop, 'Get shop info success', StatusCodes.OK);
  }),

  /**
   * Get shop by slug
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getShopBySlug: catchAsync(async (req, res) => {
    const shop = await shopService.getShopBySlug(req.params.slug);
    return sendSuccess(res, shop, 'Get shop info success', StatusCodes.OK);
  }),

  /**
   * Get my shop
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getMyShop: catchAsync(async (req, res) => {
    const shop = await shopService.getMyShop(req.user.userId);
    return sendSuccess(res, shop, 'Get my shop success', StatusCodes.OK);
  }),

  /**
   * Update shop
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateShop: catchAsync(async (req, res) => {
    const updatedShop = await shopService.updateShop(req.user.userId, req.body);
    return sendSuccess(res, updatedShop, 'Update shop success', StatusCodes.OK);
  }),

  /**
   * Get shop statistics
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getShopStatistics: catchAsync(async (req, res) => {
    const statistics = await shopService.getShopStatistics(req.user.userId);
    return sendSuccess(res, statistics, 'Get shop statistics success', StatusCodes.OK);
  }),

  /**
   * Follow a shop
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  followShop: catchAsync(async (req, res) => {
    const result = await shopService.followShop(req.user.userId, req.params.shopId);
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  /**
   * Unfollow a shop
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  unfollowShop: catchAsync(async (req, res) => {
    const result = await shopService.unfollowShop(req.user.userId, req.params.shopId);
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  /**
   * Get followed shops
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getFollowedShops: catchAsync(async (req, res) => {
    const shops = await shopService.getFollowedShops(req.user.userId);
    return sendSuccess(res, shops, 'Get followed shops success', StatusCodes.OK);
  }),

  /**
   * Upload image (logo hoặc banner)
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  uploadImage: catchAsync(async (req, res) => {
    const { type } = req.body;

    if (!req.file) {
      return sendFail(res, 'No file uploaded', StatusCodes.BAD_REQUEST);
    }

    const result = await shopService.uploadShopImage(req.file.buffer, type);
    return sendSuccess(res, result, 'Image uploaded successfully', StatusCodes.OK);
  }),

  /**
   * Upload logo (alias)
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  uploadLogo: catchAsync(async (req, res) => {
    if (!req.file) {
      return sendFail(res, 'No file uploaded', StatusCodes.BAD_REQUEST);
    }

    const result = await shopService.uploadShopImage(req.file.buffer, 'logo');
    return sendSuccess(res, result, 'Logo uploaded successfully', StatusCodes.OK);
  }),

  /**
   * Upload banner (alias)
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  uploadBanner: catchAsync(async (req, res) => {
    if (!req.file) {
      return sendFail(res, 'No file uploaded', StatusCodes.BAD_REQUEST);
    }

    const result = await shopService.uploadShopImage(req.file.buffer, 'banner');
    return sendSuccess(res, result, 'Banner uploaded successfully', StatusCodes.OK);
  }),
};

module.exports = ShopController;