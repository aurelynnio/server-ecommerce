const catchAsync = require("../configs/catchAsync");
const categoryService = require("../services/category.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");


const CategoryController = {
  // Create category (Admin only)
  createCategory: catchAsync(async (req, res) => {
    const category = await categoryService.createCategory(req.body);

    return sendSuccess(
      res,
      category,
      "Category created successfully",
      StatusCodes.CREATED
    );
  }),

  // Get all categories (Admin)
  getAllCategories: catchAsync(async (req, res) => {
    const result = await categoryService.getAllCategories(req.query);

    return sendSuccess(
      res,
      result,
      "Categories retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get active categories (Public/User)
  getActiveCategories: catchAsync(async (req, res) => {
    const result = await categoryService.getActiveCategories(req.query);

    return sendSuccess(
      res,
      result,
      "Active categories retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get category tree (Public/User)
  getCategoryTree: catchAsync(async (req, res) => {
    const tree = await categoryService.getCategoryTree();

    return sendSuccess(
      res,
      tree,
      "Category tree retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get category by ID
  getCategoryById: catchAsync(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.categoryId);

    return sendSuccess(
      res,
      category,
      "Category retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get category by slug
  getCategoryBySlug: catchAsync(async (req, res) => {
    const category = await categoryService.getCategoryBySlug(req.params.slug);

    return sendSuccess(
      res,
      category,
      "Category retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get category with subcategories
  getCategoryWithSubcategories: catchAsync(async (req, res) => {
    const result = await categoryService.getCategoryWithSubcategories(
      req.params.categoryId
    );

    return sendSuccess(
      res,
      result,
      "Category with subcategories retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Update category (Admin only)
  updateCategory: catchAsync(async (req, res) => {
    const category = await categoryService.updateCategory(
      req.params.categoryId,
      req.body
    );

    return sendSuccess(
      res,
      category,
      "Category updated successfully",
      StatusCodes.OK
    );
  }),

  // Delete category (Admin only)
  deleteCategory: catchAsync(async (req, res) => {
    const result = await categoryService.deleteCategory(req.params.categoryId);

    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  // Get category statistics (Admin only)
  getCategoryStatistics: catchAsync(async (req, res) => {
    const stats = await categoryService.getCategoryStatistics();

    return sendSuccess(
      res,
      stats,
      "Category statistics retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = CategoryController;
