const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdParamValidator,
  categorySlugParamValidator,
  getCategoriesQueryValidator,
} = require("../validations/category.validator");

/**
 * @desc    Get active categories
 * @access  Public
 */
router.get(
  "/active",
  validate({ query: getCategoriesQueryValidator }),
  categoryController.getActiveCategories
);

/**
 * @desc    Get category tree
 * @access  Public
 */
router.get("/tree", categoryController.getCategoryTree);

/**
 * @desc    Get category by slug
 * @access  Public
 */
router.get(
  "/slug/:slug",
  validate({ params: categorySlugParamValidator }),
  categoryController.getCategoryBySlug
);

/**
 * @desc    Create new category
 * @access  Private (Admin)
 */
router.post(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate(createCategoryValidator),
  categoryController.createCategory
);

/**
 * @desc    Get all categories
 * @access  Private (Admin)
 */
router.get(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: getCategoriesQueryValidator }),
  categoryController.getAllCategories
);

/**
 * @desc    Get category statistics
 * @access  Private (Admin)
 */
router.get(
  "/statistics",
  verifyAccessToken,
  requireRole("admin"),
  categoryController.getCategoryStatistics
);

/**
 * @desc    Get category by ID
 * @access  Private (Admin)
 */
router.get(
  "/:categoryId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: categoryIdParamValidator }),
  categoryController.getCategoryById
);

/**
 * @desc    Get category with subcategories
 * @access  Private (Admin)
 */
router.get(
  "/:categoryId/subcategories",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: categoryIdParamValidator }),
  categoryController.getCategoryWithSubcategories
);

/**
 * @desc    Update category
 * @access  Private (Admin)
 */
router.put(
  "/:categoryId",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: categoryIdParamValidator,
    body: updateCategoryValidator,
  }),
  categoryController.updateCategory
);

/**
 * @desc    Delete category
 * @access  Private (Admin)
 */
router.delete(
  "/:categoryId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: categoryIdParamValidator }),
  categoryController.deleteCategory
);

module.exports = router;
