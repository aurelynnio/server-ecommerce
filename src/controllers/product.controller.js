const catchAsync = require("../configs/catchAsync");
const productService = require("../services/product.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { ApiError } = require("../middlewares/errorHandler.middleware");

/**
 * Product Controller
 * Handles product CRUD operations, variants, and product queries
 */
const ProductController = {
  /**
   * Get all products with filtering, sorting, and pagination
   * @access Public
   */
  getAllProducts: catchAsync(async (req, res) => {

    const result = await productService.getAllProducts(req.query);
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get single product by ID
   * @access Public
   */
  getProductById: catchAsync(async (req, res) => {
    const product = await productService.getProductById(req.params.id);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get single product by slug
   * @access Public
   */
  getProductBySlug: catchAsync(async (req, res) => {
    const product = await productService.getProductBySlug(req.params.slug);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Create a new product
   * @access Private (Seller only)
   */
  createProduct: catchAsync(async (req, res) => {
    const User = require("../models/user.model");
    const Shop = require("../models/shop.model");
    
    const user = await User.findById(req.user.userId);
    let shopId = user?.shop;
    
    if (!shopId) {
      const shop = await Shop.findOne({ owner: req.user.userId });
      if (shop) {
        await User.findByIdAndUpdate(req.user.userId, { shop: shop._id });
        shopId = shop._id;
      }
    }
    
    if (!shopId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "User does not have a shop. Please register a shop first."
      );
    }

    const product = await productService.createProduct(
      req.body,
      req.files,
      shopId
    );

    return sendSuccess(
      res,
      product,
      "Product created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Permanently delete a product
   * @access Private (Admin only)
   */
  permanentDeleteProduct: catchAsync(async (req, res) => {
    await productService.permanentDeleteProduct(req.params.id);
    return sendSuccess(
      res,
      null,
      "Product permanently deleted",
      StatusCodes.OK
    );
  }),

  /**
   * Get products by category ID
   * @access Public
   */
  getProductsByCategory: catchAsync(async (req, res) => {
    const result = await productService.getProductsByCategory(
      req.params.categoryId,
      req.query
    );
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get products by category slug
   * @access Public
   */
  getProductsByCategorySlug: catchAsync(async (req, res) => {
    const result = await productService.getProductsByCategorySlug(
      req.params.slug,
      req.query
    );
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get featured products
   * @access Public
   */
  getFeaturedProducts: catchAsync(async (req, res) => {
    const products = await productService.getFeaturedProductsSimple(
      req.query.limit
    );
    return sendSuccess(
      res,
      products,
      "Featured products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get new arrival products
   * @access Public
   */
  getNewArrivalProducts: catchAsync(async (req, res) => {
    const result = await productService.getNewArrivalProducts();
    return sendSuccess(
      res,
      result,
      "New arrival products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get products on sale
   * @access Public
   */
  getOnSaleProducts: catchAsync(async (req, res) => {
    const result = await productService.getOnSaleProducts();
    return sendSuccess(
      res,
      result,
      "On sale products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Search products by keyword
   * @access Public
   */
  searchProducts: catchAsync(async (req, res) => {
    const result = await productService.searchProducts(
      req.query.q,
      req.query.limit
    );
    return sendSuccess(
      res,
      result,
      "Products found successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get related products
   * @access Public
   */
  getRelatedProducts: catchAsync(async (req, res) => {
    const { id } = req.params;

    const result = await productService.getRelatedProducts(id);

    return sendSuccess(
      res,
      result,
      "Related products retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update product by seller (own shop only)
   * @access Private (Seller or Admin)
   */
  updateProductBySeller: catchAsync(async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop._id;

    const product = await productService.updateProductBySeller(
      id,
      shopId,
      req.body,
      req.files
    );
    return sendSuccess(
      res,
      product,
      "Product updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Delete product by seller (own shop only, soft delete)
   * @access Private (Seller or Admin)
   */
  deleteProductBySeller: catchAsync(async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop._id;

    const product = await productService.deleteProductBySeller(id, shopId);
    return sendSuccess(
      res,
      product,
      "Product deleted successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Add variant by seller
   * @access Private (Seller)
   */
  addVariantBySeller: catchAsync(async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop._id;
    
    const product = await productService.addVariantBySeller(id, shopId, req.body, req.files);
    return sendSuccess(res, product, "Variant added successfully", StatusCodes.CREATED);
  }),

  /**
   * Update variant by seller
   * @access Private (Seller)
   */
  updateVariantBySeller: catchAsync(async (req, res) => {
    const { id, variantId } = req.params;
    const shopId = req.shop._id;

    const product = await productService.updateVariantBySeller(id, shopId, variantId, req.body);
    return sendSuccess(res, product, "Variant updated successfully", StatusCodes.OK);
  }),

  /**
   * Delete variant by seller
   * @access Private (Seller)
   */
  deleteVariantBySeller: catchAsync(async (req, res) => {
    const { id, variantId } = req.params;
    const shopId = req.shop._id;

    const product = await productService.deleteVariantBySeller(id, shopId, variantId);
    return sendSuccess(res, product, "Variant deleted successfully", StatusCodes.OK);
  }),
};

module.exports = ProductController;
