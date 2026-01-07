const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const upload = require("../configs/upload");
const validate = require("../middlewares/validate.middleware");
const parseJsonFields = require("../middlewares/parseJsonFields.middleware");
const {
  createProductValidator,
  updateProductValidator,
  addVariantValidator,
  updateVariantValidator,
  getProductsQueryValidator,
  mongoIdParamValidator,
  slugParamValidator,
  categoryIdParamValidator,
  categorySlugParamValidator,
  variantIdsParamValidator,
  paginationQueryValidator,
  limitQueryValidator,
  specialProductsQueryValidator,
  searchQueryValidator,
} = require("../validations/product.validator");

/**
 * Public Routes
 */

/**
 * @route   GET /api/products
 * @desc    Get all products with filters and pagination
 * @access  Public
 * @query   page, limit, sort, category, brand, minPrice, maxPrice, tags, search
 */
router.get("/", validate({ query: getProductsQueryValidator }), productController.getAllProducts);

/**
 * @route   GET /api/products/search
 * @desc    Search products (autocomplete)
 * @access  Public
 * @query   q, limit
 */
router.get("/search", validate({ query: searchQueryValidator }), productController.searchProducts);

/**
 * @route   GET /api/products/featured
 * @desc    Get featured products
 * @access  Public
 * @query   limit
 */
router.get("/featured", validate({ query: limitQueryValidator }), productController.getFeaturedProducts);

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
router.get("/slug/:slug", validate({ params: slugParamValidator }), productController.getProductBySlug);

/**
 * @route   GET /api/products/category/:slug
 * @desc    Get products by category slug
 * @access  Public
 * @query   page, limit, sort
 */
router.get(
  "/category/:slug",
  validate({ params: categorySlugParamValidator, query: paginationQueryValidator }),
  productController.getProductsByCategorySlug
);

/**
 * @route   GET /api/products/related/:id
 * @desc    Get related products (same category)
 * @access  Public
 * @query   limit, type (random, newest, best-selling)
 */
router.get("/related/:id", validate({ params: mongoIdParamValidator }), productController.getRelatedProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get("/:id", validate({ params: mongoIdParamValidator }), productController.getProductById);

/**
 * Protected Routes - Admin Only
 */

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private (Seller only)
 */
router.post(
  "/",
  verifyAccessToken,
  requireRole("seller", "admin"),
  upload.any(), // Allow any files (images, variantImages_0, etc.)
  parseJsonFields(["price", "variants", "tags", "tierVariations", "models", "attributes", "dimensions", "variantImageMapping"]),
  validate(createProductValidator),
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
  upload.any(), // Allow any files (variantImages_0, etc.)
  parseJsonFields(["price", "variants", "tags", "tierVariations", "models", "attributes", "dimensions", "variantImageMapping", "existingDescriptionImages", "existingVariantImages"]),
  validate({ params: mongoIdParamValidator, body: updateProductValidator }),
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
  validate({ params: mongoIdParamValidator }),
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
  validate({ params: mongoIdParamValidator }),
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
  upload.array("images", 10),
  parseJsonFields(["price"]),
  validate({ params: mongoIdParamValidator, body: addVariantValidator }), // Note: req.body here will be validated
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
  validate({ params: variantIdsParamValidator, body: updateVariantValidator }),
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
  validate({ params: variantIdsParamValidator }),
  productController.deleteVariant
);

module.exports = router;

