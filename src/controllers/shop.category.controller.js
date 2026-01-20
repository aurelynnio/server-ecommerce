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

* @access  Private (Seller only)





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

* @access  Private (Seller only)

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

* @access  Public


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

* @access  Private (Seller only - own categories)







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

* @access  Private (Seller only - own categories)


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
