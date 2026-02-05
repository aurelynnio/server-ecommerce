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
const { validateImageSignature } = require("../middlewares/uploadSignature.middleware");
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
  validateImageSignature,
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
  validateImageSignature,
  parseJsonFields(["price", "variants", "tags", "tierVariations", "models", "attributes", "dimensions", "variantImageMapping"]),
  validate(createProductValidator),
  productController.createProduct
);

/**
 * @desc    Add variant by seller
 * @access  Private (Seller/Admin)
 */
router.post(
  "/seller/:id/variants",
  verifyAccessToken,
  requireRole("seller", "admin"),
  verifyShopOwnership,
  verifyProductOwnership,
  upload.array("images", 10),
  validateImageSignature,
  parseJsonFields(["price"]),
  validate({ params: mongoIdParamValidator, body: addVariantValidator }),
  productController.addVariantBySeller
);

/**
 * @desc    Update variant by seller
 * @access  Private (Seller/Admin)
 */
router.put(
  "/seller/:id/variants/:variantId",
  verifyAccessToken,
  requireRole("seller", "admin"),
  verifyShopOwnership,
  verifyProductOwnership,
  validate({ params: variantIdsParamValidator, body: updateVariantValidator }),
  productController.updateVariantBySeller
);

/**
 * @desc    Delete variant by seller
 * @access  Private (Seller/Admin)
 */
router.delete(
  "/seller/:id/variants/:variantId",
  verifyAccessToken,
  requireRole("seller", "admin"),
  verifyShopOwnership,
  verifyProductOwnership,
  validate({ params: variantIdsParamValidator }),
  productController.deleteVariantBySeller
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

module.exports = router;
