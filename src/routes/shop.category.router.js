const express = require("express");
const router = express.Router();
const shopCategoryController = require("../controllers/shop.category.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createCategoryValidator,
  updateCategoryValidator,
} = require("../validations/shop.category.validator");

/**
 * Public Routes
 */

/**
 * @route   GET /api/shop-categories/:shopId
 * @desc    Get all categories for a specific shop
 * @access  Public
 * @param   shopId - Shop ID
 */
router.get("/:shopId", shopCategoryController.getShopCategories);

/**
 * Protected Routes (Seller only)
 */
router.use(verifyAccessToken, requireRole("seller"));

/**
 * @route   POST /api/shop-categories
 * @desc    Create a new shop category
 * @access  Private (Seller only)
 * @body    { name, description?, parentCategory?, order? }
 */
router.post(
  "/",
  validate(createCategoryValidator),
  shopCategoryController.createCategory
);

/**
 * @route   PUT /api/shop-categories/:categoryId
 * @desc    Update a shop category
 * @access  Private (Seller only - own categories)
 * @param   categoryId - Category ID to update
 * @body    { name?, description?, parentCategory?, order?, isActive? }
 */
router.put(
  "/:categoryId",
  validate(updateCategoryValidator),
  shopCategoryController.updateCategory
);

/**
 * @route   DELETE /api/shop-categories/:categoryId
 * @desc    Delete a shop category
 * @access  Private (Seller only - own categories)
 * @param   categoryId - Category ID to delete
 */
router.delete("/:categoryId", shopCategoryController.deleteCategory);

module.exports = router;
