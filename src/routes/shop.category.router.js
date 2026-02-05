
const express = require("express");

const router = express.Router();

const shopCategoryController = require("../controllers/shop.category.controller");

const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");

const validate = require("../middlewares/validate.middleware");

const {
  createShopCategoryValidator,
  updateShopCategoryValidator,
} = require("../validations/shop.category.validator");

/**
 * Protected Routes (Seller only) - Define specific routes FIRST
 */
/**
 * @desc    Get all categories for current seller's shop
 * @access  Private (Seller only)
 */
router.get(
  "/my",
  verifyAccessToken,
  requireRole("seller"),
  shopCategoryController.getMyShopCategories
);

/**
 * @desc    Create a new shop category
 * @access  Private (Seller only)
 * @body    { name, description?, parentCategory?, order? }
 */
router.post(
  "/",
  verifyAccessToken,
  requireRole("seller"),
  validate(createShopCategoryValidator),
  shopCategoryController.createCategory
);

/**
 * @desc    Update a shop category
 * @access  Private (Seller only - own categories)
 * @param   categoryId - Category ID to update
 * @body    { name?, description?, parentCategory?, order?, isActive? }
 */
router.put(
  "/:categoryId",
  verifyAccessToken,
  requireRole("seller"),
  validate(updateShopCategoryValidator),
  shopCategoryController.updateCategory
);

/**
 * @desc    Delete a shop category
 * @access  Private (Seller only - own categories)
 * @param   categoryId - Category ID to delete
 */
router.delete(
  "/:categoryId",
  verifyAccessToken,
  requireRole("seller"),
  shopCategoryController.deleteCategory
);

/**
 * Public Routes - Define param routes LAST
 */
/**
 * @desc    Get all categories for a specific shop
 * @access  Public
 * @param   shopId - Shop ID
 */
router.get("/:shopId", shopCategoryController.getShopCategories);

module.exports = router;
