const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const upload = require("../configs/upload");

/**
 * Public Routes
 */

/**
 * @route   GET /api/products
 * @desc    Get all products with filters and pagination
 * @access  Public
 * @query   page, limit, sort, category, brand, minPrice, maxPrice, tags, search
 */
router.get("/", productController.getAllProducts);

/**
 * @route   GET /api/products/search
 * @desc    Search products (autocomplete)
 * @access  Public
 * @query   q, limit
 */
router.get("/search", productController.searchProducts);

/**
 * @route   GET /api/products/featured
 * @desc    Get featured products
 * @access  Public
 * @query   limit
 */
router.get("/featured", productController.getFeaturedProducts);

/**
 * @route   GET /api/products/new-arrivals
 * @desc    Get new arrival products
 * @access  Public
 */
router.get("/new-arrivals", productController.getNewArrivalProducts);

/**
 * @route   GET /api/products/on-sale
 * @desc    Get products on sale
 * @access  Public
 */
router.get("/on-sale", productController.getOnSaleProducts);

/**
 * @route   GET /api/products/slug/:slug
 * @desc    Get product by slug
 * @access  Public
 */
router.get("/slug/:slug", productController.getProductBySlug);

/**
 * @route   GET /api/products/category/:slug
 * @desc    Get products by category slug
 * @access  Public
 * @query   page, limit, sort
 */
router.get("/category/:slug", productController.getProductsByCategorySlug);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get("/:id", productController.getProductById);

/**
 * Protected Routes - Admin Only
 */

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private (Admin only)
 */
router.post(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  upload.array("images", 5),
  productController.createProduct
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Admin only)
 */
router.put(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  upload.array("images", 5),
  productController.updateProduct
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  productController.deleteProduct
);

/**
 * @route   DELETE /api/products/:id/permanent
 * @desc    Permanently delete product
 * @access  Private (Admin only)
 */
router.delete(
  "/:id/permanent",
  verifyAccessToken,
  requireRole("admin"),
  productController.permanentDeleteProduct
);

/**
 * Variant Routes - Admin Only
 */

/**
 * @route   POST /api/products/:id/variants
 * @desc    Add variant to product
 * @access  Private (Admin only)
 */
router.post(
  "/:id/variants",
  verifyAccessToken,
  requireRole("admin"),
  upload.array("images", 5),
  productController.addVariant
);

/**
 * @route   PUT /api/products/:id/variants/:variantId
 * @desc    Update variant
 * @access  Private (Admin only)
 */
router.put(
  "/:id/variants/:variantId",
  verifyAccessToken,
  requireRole("admin"),
  productController.updateVariant
);

/**
 * @route   DELETE /api/products/:id/variants/:variantId
 * @desc    Delete variant
 * @access  Private (Admin only)
 */
router.delete(
  "/:id/variants/:variantId",
  verifyAccessToken,
  requireRole("admin"),
  productController.deleteVariant
);

module.exports = router;
