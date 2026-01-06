const catchAsync = require("../configs/catchAsync");
const categoryService = require("../services/category.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Category Controller
 * Handles category CRUD operations and category tree management
 */
const CategoryController = {
  /**
   * Create a new category (Admin only)
   * @route POST /api/categories
   * @access Private (Admin)
   * @body {string} name - Category name
   * @body {string} [slug] - Category slug (auto-generated if not provided)
   * @body {string} [description] - Category description
   * @body {string} [parentCategory] - Parent category ID
   * @returns {Object} Created category
   */
  createCategory: catchAsync(async (req, res) => {
    const category = await categoryService.createCategory(req.body);

    return sendSuccess(
      res,
      category,
      "Category created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get all categories with pagination (Admin)
   * @route GET /api/categories/admin
   * @access Private (Admin)
   * @query {number} page - Page number
   * @query {number} limit - Items per page
   * @query {boolean} [isActive] - Filter by active status
   * @query {string} [parentCategory] - Filter by parent category
   * @returns {Object} Categories with pagination
   */
  getAllCategories: catchAsync(async (req, res) => {
    const result = await categoryService.getAllCategories(req.query);

    return sendSuccess(
      res,
      result,
      "Categories retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get active categories for public display
   * @route GET /api/categories
   * @access Public
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @returns {Object} Active categories with pagination
   */
  getActiveCategories: catchAsync(async (req, res) => {
    const result = await categoryService.getActiveCategories(req.query);

    return sendSuccess(
      res,
      result,
      "Active categories retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get hierarchical category tree
   * @route GET /api/categories/tree
   * @access Public
   * @returns {Array} Category tree with nested subcategories
   */
  getCategoryTree: catchAsync(async (req, res) => {
    const tree = await categoryService.getCategoryTree();

    return sendSuccess(
      res,
      tree,
      "Category tree retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get category by ID
   * @route GET /api/categories/:categoryId
   * @access Public
   * @param {string} categoryId - Category ID
   * @returns {Object} Category object
   */
  getCategoryById: catchAsync(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.categoryId);

    return sendSuccess(
      res,
      category,
      "Category retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get category by slug
   * @route GET /api/categories/slug/:slug
   * @access Public
   * @param {string} slug - Category slug
   * @returns {Object} Category object
   */
  getCategoryBySlug: catchAsync(async (req, res) => {
    const category = await categoryService.getCategoryBySlug(req.params.slug);

    return sendSuccess(
      res,
      category,
      "Category retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get category with its subcategories
   * @route GET /api/categories/:categoryId/subcategories
   * @access Public
   * @param {string} categoryId - Category ID
   * @returns {Object} Category with subcategories array
   */
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

  /**
   * Update a category (Admin only)
   * @route PUT /api/categories/:categoryId
   * @access Private (Admin)
   * @param {string} categoryId - Category ID
   * @body {Object} updateData - Fields to update
   * @returns {Object} Updated category
   */
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

  /**
   * Delete a category (Admin only)
   * @route DELETE /api/categories/:categoryId
   * @access Private (Admin)
   * @param {string} categoryId - Category ID
   * @returns {Object} Deletion confirmation
   */
  deleteCategory: catchAsync(async (req, res) => {
    const result = await categoryService.deleteCategory(req.params.categoryId);

    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  /**
   * Get category statistics (Admin only)
   * @route GET /api/categories/statistics
   * @access Private (Admin)
   * @returns {Object} Category statistics
   */
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
