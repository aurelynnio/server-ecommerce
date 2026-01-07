const shopCategoryService = require("../services/shop.category.service");
const catchAsync = require("../configs/catchAsync");
const { sendSuccess } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Shop Category Controller
 * Handles shop-specific category operations for sellers
 */
const ShopCategoryController = {
  /**
   * Create a new shop category
   * @route POST /api/shop-categories
   * @access Private (Seller only)
   * @body {string} name - Category name
   * @body {string} [description] - Category description
   * @body {string} [parentCategory] - Parent category ID
   * @body {number} [order] - Display order
   * @returns {Object} Created category object
   */
  createCategory: catchAsync(async (req, res) => {
    const newCategory = await shopCategoryService.createCategory(
      req.user.userId,
      req.body
    );
    return sendSuccess(
      res,
      newCategory,
      "Shop category created",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get all categories for current seller's shop
   * @route GET /api/shop-categories
   * @access Private (Seller only)
   * @returns {Array} Shop categories
   */
  getMyShopCategories: catchAsync(async (req, res) => {
    const categories = await shopCategoryService.getMyShopCategories(
      req.user.userId
    );
    return sendSuccess(
      res,
      categories,
      "Get my shop categories success",
      StatusCodes.OK
    );
  }),

  /**
   * Get all categories for a specific shop
   * @route GET /api/shop-categories/:shopId
   * @access Public
   * @param {string} shopId - Shop ID
   * @returns {Array} Shop categories
   */
  getShopCategories: catchAsync(async (req, res) => {
    const categories = await shopCategoryService.getShopCategories(
      req.user ? req.user.userId : null,
      req.params.shopId
    );
    return sendSuccess(
      res,
      categories,
      "Get shop categories success",
      StatusCodes.OK
    );
  }),

  /**
   * Update a shop category
   * @route PUT /api/shop-categories/:categoryId
   * @access Private (Seller only - own categories)
   * @param {string} categoryId - Category ID to update
   * @body {string} [name] - Updated name
   * @body {string} [description] - Updated description
   * @body {string} [parentCategory] - Updated parent category
   * @body {number} [order] - Updated display order
   * @body {boolean} [isActive] - Active status
   * @returns {Object} Updated category object
   */
  updateCategory: catchAsync(async (req, res) => {
    const updated = await shopCategoryService.updateCategory(
      req.user.userId,
      req.params.categoryId,
      req.body
    );
    return sendSuccess(res, updated, "Category updated", StatusCodes.OK);
  }),

  /**
   * Delete a shop category
   * @route DELETE /api/shop-categories/:categoryId
   * @access Private (Seller only - own categories)
   * @param {string} categoryId - Category ID to delete
   * @returns {Object} Deletion confirmation
   */
  deleteCategory: catchAsync(async (req, res) => {
    const deleted = await shopCategoryService.deleteCategory(
      req.user.userId,
      req.params.categoryId
    );
    return sendSuccess(res, deleted, "Category deleted", StatusCodes.OK);
  }),
};

module.exports = ShopCategoryController;
