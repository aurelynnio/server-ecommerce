const shopService = require('../services/shop.service');
const catchAsync = require('../configs/catchAsync');
const { uploadImage } = require('../configs/cloudinary');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const handleUploadShopImage = async (req, res, type) => {
  const file = req.file;

  if (!file) {
    return sendFail(res, 'No file uploaded', StatusCodes.BAD_REQUEST);
  }

  if (!type || !['logo', 'banner'].includes(type)) {
    return sendFail(res, "Invalid image type. Must be 'logo' or 'banner'", StatusCodes.BAD_REQUEST);
  }

  const folder = type === 'logo' ? 'shop-logos' : 'shop-banners';
  const result = await uploadImage(file.buffer, folder);

  if (!result) {
    return sendFail(res, 'Image upload failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  const payload = type === 'logo' ? { logo: result.secure_url } : { banner: result.secure_url };

  return sendSuccess(res, payload, 'Image uploaded successfully', StatusCodes.OK);
};

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
   * Upload image
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  uploadImage: catchAsync(async (req, res) => {
    const { type } = req.body;
    return handleUploadShopImage(req, res, type);
  }),

  /**
   * Upload logo (alias)
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  uploadLogo: catchAsync(async (req, res) => {
    return handleUploadShopImage(req, res, 'logo');
  }),

  /**
   * Upload banner (alias)
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  uploadBanner: catchAsync(async (req, res) => {
    return handleUploadShopImage(req, res, 'banner');
  }),
};

module.exports = ShopController;
