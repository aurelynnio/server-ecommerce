const catchAsync = require("../configs/catchAsync");
const productService = require("../services/product.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");



const ProductController = {
  // Get all products with filters
  getAllProducts: catchAsync(async (req, res) => {


    const result = await productService.getAllProducts(req.query);
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get single product by ID
  getProductById: catchAsync(async (req, res) => {


    const product = await productService.getProductById(req.params.id);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get single product by slug
  getProductBySlug: catchAsync(async (req, res) => {


    const product = await productService.getProductBySlug(req.params.slug);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Create new product
  createProduct: catchAsync(async (req, res) => {
    const product = await productService.createProduct(req.body, req.files);
    return sendSuccess(
      res,
      product,
      "Product created successfully",
      StatusCodes.CREATED
    );
  }),

  // Trong controller, thêm debug cho validator error
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

  // Delete product (soft delete)
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

  // Permanently delete product
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

  // Add variant to product
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

  // Update variant
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

  // Delete variant
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

  // Get products by category
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

  // Get products by category slug
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

  // Get featured products
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



  // Get new arrival products (simple - 10 items only)
  getNewArrivalProducts: catchAsync(async (req, res) => {
    const result = await productService.getNewArrivalProducts();
    return sendSuccess(
      res,
      result,
      "New arrival products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get products on sale (simple - 10 items only)
  getOnSaleProducts: catchAsync(async (req, res) => {
    const result = await productService.getOnSaleProducts();
    return sendSuccess(
      res,
      result,
      "On sale products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Search products
  searchProducts: catchAsync(async (req, res) => {
    const result = await productService.searchProducts(req.query.q, req.query.limit);
    return sendSuccess(
      res,
      result,
      "Products found successfully",
      StatusCodes.OK
    );
  }),

  // Get related products
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

};

module.exports = ProductController;
