const catchAsync = require("../configs/catchAsync");
const productService = require("../services/product.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Product Controller
 * Handles product CRUD operations, variants, and product queries
 */
const ProductController = {
  /**
   * Get all products with filtering, sorting, and pagination
   * @route GET /api/products
   * @access Public
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @query {string} [category] - Filter by category ID
   * @query {string} [brand] - Filter by brand
   * @query {number} [minPrice] - Minimum price
   * @query {number} [maxPrice] - Maximum price
   * @query {string} [search] - Search term
   * @returns {Object} Products with pagination metadata
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
   * @route GET /api/products/:id
   * @access Public
   * @param {string} id - Product ID
   * @returns {Object} Product object with populated fields
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
   * @route GET /api/products/slug/:slug
   * @access Public
   * @param {string} slug - Product slug
   * @returns {Object} Product object
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
   * @route POST /api/products
   * @access Private (Seller only)
   * @body {string} name - Product name
   * @body {Object} price - Price information
   * @body {string} [description] - Product description
   * @files {Array} [images] - Product images
   * @returns {Object} Created product
   */
  createProduct: catchAsync(async (req, res) => {
    // Fetch user from database to get shop ID
    const User = require("../models/user.model");
    const Shop = require("../models/shop.model");
    
    const user = await User.findById(req.user.userId);
    let shopId = user?.shop;
    
    // If user doesn't have shop field set, try to find shop by owner
    if (!shopId) {
      const shop = await Shop.findOne({ owner: req.user.userId });
      if (shop) {
        // Fix the user's shop field
        await User.findByIdAndUpdate(req.user.userId, { shop: shop._id });
        shopId = shop._id;
      }
    }
    
    if (!shopId) {
      throw new Error("User does not have a shop. Please register a shop first.");
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
   * Update an existing product
   * @route PUT /api/products/:id
   * @access Private (Seller/Admin)
   * @param {string} id - Product ID
   * @body {Object} updateData - Fields to update
   * @files {Array} [images] - New product images
   * @returns {Object} Updated product
   */
  updateProduct: catchAsync(async (req, res) => {
    // Parse JSON fields handled by middleware
    // Validate request body handled by middleware

    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body, req.files);
    return sendSuccess(
      res,
      product,
      "Product updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Soft delete a product
   * @route DELETE /api/products/:id
   * @access Private (Seller/Admin)
   * @param {string} id - Product ID
   * @returns {Object} Deleted product
   */
  deleteProduct: catchAsync(async (req, res) => {
    // Validate params

    const product = await productService.deleteProduct(req.params.id);
    return sendSuccess(
      res,
      product,
      "Product deleted successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Permanently delete a product
   * @route DELETE /api/products/:id/permanent
   * @access Private (Admin only)
   * @param {string} id - Product ID
   * @returns {Object} Success message
   */
  permanentDeleteProduct: catchAsync(async (req, res) => {
    // Validate params

    await productService.permanentDeleteProduct(req.params.id);
    return sendSuccess(
      res,
      null,
      "Product permanently deleted",
      StatusCodes.OK
    );
  }),

  /**
   * Add a variant to a product
   * @route POST /api/products/:id/variants
   * @access Private (Seller/Admin)
   * @param {string} id - Product ID
   * @body {string} sku - Variant SKU
   * @body {string} [color] - Variant color
   * @body {string} [size] - Variant size
   * @body {number} price - Variant price
   * @body {number} stock - Variant stock
   * @returns {Object} Updated product with new variant
   */
  addVariant: catchAsync(async (req, res) => {
    const { id } = req.params;

    const product = await productService.addVariant(id, req.body, req.files);
    return sendSuccess(
      res,
      product,
      "Variant added successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Update a product variant
   * @route PUT /api/products/:id/variants/:variantId
   * @access Private (Seller/Admin)
   * @param {string} id - Product ID
   * @param {string} variantId - Variant ID
   * @body {Object} variantData - Variant fields to update
   * @returns {Object} Updated product
   */
  updateVariant: catchAsync(async (req, res) => {
    const { id, variantId } = req.params;
    const product = await productService.updateVariant(id, variantId, req.body);
    return sendSuccess(
      res,
      product,
      "Variant updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Delete a product variant
   * @route DELETE /api/products/:id/variants/:variantId
   * @access Private (Seller/Admin)
   * @param {string} id - Product ID
   * @param {string} variantId - Variant ID
   * @returns {Object} Updated product
   */
  deleteVariant: catchAsync(async (req, res) => {
    const product = await productService.deleteVariant(
      req.params.id,
      req.params.variantId
    );
    return sendSuccess(
      res,
      product,
      "Variant deleted successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get products by category ID
   * @route GET /api/products/category/:categoryId
   * @access Public
   * @param {string} categoryId - Category ID
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @returns {Object} Products with pagination
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
   * @route GET /api/products/category/slug/:slug
   * @access Public
   * @param {string} slug - Category slug
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @returns {Object} Products with category info and pagination
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
   * @route GET /api/products/featured
   * @access Public
   * @query {number} [limit=10] - Maximum products to return
   * @returns {Array} Featured products
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
   * @route GET /api/products/new-arrivals
   * @access Public
   * @returns {Array} New arrival products (max 10)
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
   * @route GET /api/products/on-sale
   * @access Public
   * @returns {Array} On-sale products (max 10)
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
   * @route GET /api/products/search
   * @access Public
   * @query {string} q - Search keyword
   * @query {number} [limit=10] - Maximum results
   * @returns {Array} Matching products
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
   * @route GET /api/products/:id/related
   * @access Public
   * @param {string} id - Product ID
   * @returns {Array} Related products (max 10)
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
   * @route PUT /api/products/seller/:id
   * @access Private (Seller or Admin)
   * @param {string} id - Product ID
   * @body {Object} updateData - Fields to update
   * @files {Array} [images] - New product images
   * @returns {Object} Updated product
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
   * @route DELETE /api/products/seller/:id
   * @access Private (Seller or Admin)
   * @param {string} id - Product ID
   * @returns {Object} Deleted product
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
};

module.exports = ProductController;
