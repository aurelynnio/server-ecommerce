const shopCategoryService = require('../services/shop.category.service');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const ShopCategoryController = {
  /**
   * Create category
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createCategory: catchAsync(async (req, res) => {
    const newCategory = await shopCategoryService.createCategory(req.user.userId, req.body);
    return sendSuccess(res, newCategory, 'Shop category created', StatusCodes.CREATED);
  }),

  /**
   * Get my shop categories
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getMyShopCategories: catchAsync(async (req, res) => {
    const categories = await shopCategoryService.getMyShopCategories(req.user.userId);
    return sendSuccess(res, categories, 'Get my shop categories success', StatusCodes.OK);
  }),

  /**
   * Get shop categories
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getShopCategories: catchAsync(async (req, res) => {
    const categories = await shopCategoryService.getShopCategories(
      req.user ? req.user.userId : null,
      req.params.shopId,
    );
    return sendSuccess(res, categories, 'Get shop categories success', StatusCodes.OK);
  }),

  /**
   * Update category
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateCategory: catchAsync(async (req, res) => {
    const updated = await shopCategoryService.updateCategory(
      req.user.userId,
      req.params.categoryId,
      req.body,
    );
    return sendSuccess(res, updated, 'Category updated', StatusCodes.OK);
  }),

  /**
   * Delete category
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteCategory: catchAsync(async (req, res) => {
    const deleted = await shopCategoryService.deleteCategory(
      req.user.userId,
      req.params.categoryId,
    );
    return sendSuccess(res, deleted, 'Category deleted', StatusCodes.OK);
  }),
};

module.exports = ShopCategoryController;
