const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const {
  verifyShopOwnership,
  verifyProductOwnership,
} = require("../middlewares/ownership.middleware");
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
  searchQueryValidator,
} = require("../validations/product.validator");

/**
 * @desc    Get all products with filters and pagination
 * @access  Public
 */
router.get("/", validate({ query: getProductsQueryValidator }), productController.getAllProducts);

/**
 * @desc    Search products (autocomplete)
 * @access  Public
 */
router.get("/search", validate({ query: searchQueryValidator }), productController.searchProducts);

/**
 * @desc    Get featured products
 * @access  Public
 */
router.get("/featured", validate({ query: limitQueryValidator }), productController.getFeaturedProducts);

/**
 * @desc    Get new arrival products
 * @access  Public
 */
router.get("/new-arrivals", productController.getNewArrivalProducts);

/**
 * @desc    Get products on sale
 * @access  Public
 */
router.get("/on-sale", productController.getOnSaleProducts);

/**
 * @desc    Get product by slug
 * @access  Public
 */
router.get("/slug/:slug", validate({ params: slugParamValidator }), productController.getProductBySlug);

/**
 * @desc    Get products by category slug
 * @access  Public
 */
router.get(
  "/category/:slug",
  validate({ params: categorySlugParamValidator, query: paginationQueryValidator }),
  productController.getProductsByCategorySlug
);

/**
 * @desc    Get related products (same category)
 * @access  Public
 */
router.get("/related/:id", validate({ params: mongoIdParamValidator }), productController.getRelatedProducts);

/**
 * @desc    Update product by seller (own shop only)
 * @access  Private (Seller or Admin)
 */
router.put(
  "/seller/:id",
  verifyAccessToken,
  requireRole("seller", "admin"),
  verifyShopOwnership,
  verifyProductOwnership,
  upload.any(),
  parseJsonFields(["price", "variants", "tags", "tierVariations", "models", "attributes", "dimensions", "variantImageMapping", "existingDescriptionImages", "existingVariantImages"]),
  validate({ params: mongoIdParamValidator, body: updateProductValidator }),
  productController.updateProductBySeller
);

/**
 * @desc    Delete product by seller (own shop only, soft delete)
 * @access  Private (Seller or Admin)
 */
router.delete(
  "/seller/:id",
  verifyAccessToken,
  requireRole("seller", "admin"),
  verifyShopOwnership,
  verifyProductOwnership,
  validate({ params: mongoIdParamValidator }),
  productController.deleteProductBySeller
);

/**
 * @desc    Get product by ID
 * @access  Public
 */
router.get("/:id", validate({ params: mongoIdParamValidator }), productController.getProductById);

/**
 * @desc    Create new product
 * @access  Private (Seller/Admin)
 */
router.post(
  "/",
  verifyAccessToken,
  requireRole("seller", "admin"),
  upload.any(),
  parseJsonFields(["price", "variants", "tags", "tierVariations", "models", "attributes", "dimensions", "variantImageMapping"]),
  validate(createProductValidator),
  productController.createProduct
);

/**
 * @desc    Update product
 * @access  Private (Admin only)
 */
router.put(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  upload.any(),
  parseJsonFields(["price", "variants", "tags", "tierVariations", "models", "attributes", "dimensions", "variantImageMapping", "existingDescriptionImages", "existingVariantImages"]),
  validate({ params: mongoIdParamValidator, body: updateProductValidator }),
  productController.updateProduct
);

/**
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
 * @desc    Add variant to product
 * @access  Private (Admin only)
 */
router.post(
  "/:id/variants",
  verifyAccessToken,
  requireRole("admin"),
  upload.array("images", 10),
  parseJsonFields(["price"]),
  validate({ params: mongoIdParamValidator, body: addVariantValidator }),
  productController.addVariant
);

/**
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
