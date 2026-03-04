const catchAsync = require('../configs/catchAsync');
const productService = require('../services/product.service');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess } = require('../shared/res/formatResponse');

const ProductController = {
  /**
   * Get all products
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getAllProducts: catchAsync(async (req, res) => {
    const result = await productService.getAllProducts(req.query);
    return sendSuccess(res, result, 'Products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get product by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getProductById: catchAsync(async (req, res) => {
    const product = await productService.getProductById(req.params.id);
    return sendSuccess(res, product, 'Product retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get product by slug
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getProductBySlug: catchAsync(async (req, res) => {
    const product = await productService.getProductBySlug(req.params.slug);
    return sendSuccess(res, product, 'Product retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Create product
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createProduct: catchAsync(async (req, res) => {
    const product = await productService.createProduct(req.body, req.files, req.user.userId);

    return sendSuccess(res, product, 'Product created successfully', StatusCodes.CREATED);
  }),

  /**
   * Permanent delete product
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  permanentDeleteProduct: catchAsync(async (req, res) => {
    await productService.permanentDeleteProduct(req.params.id);
    return sendSuccess(res, null, 'Product permanently deleted', StatusCodes.OK);
  }),

  /**
   * Get products by category
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getProductsByCategory: catchAsync(async (req, res) => {
    const result = await productService.getProductsByCategory(req.params.categoryId, req.query);
    return sendSuccess(res, result, 'Products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get products by category slug
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getProductsByCategorySlug: catchAsync(async (req, res) => {
    const result = await productService.getProductsByCategorySlug(req.params.slug, req.query);
    return sendSuccess(res, result, 'Products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get featured products
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getFeaturedProducts: catchAsync(async (req, res) => {
    const products = await productService.getFeaturedProductsSimple(req.query.limit);
    return sendSuccess(res, products, 'Featured products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get new arrival products
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getNewArrivalProducts: catchAsync(async (req, res) => {
    const result = await productService.getNewArrivalProducts();
    return sendSuccess(res, result, 'New arrival products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get on sale products
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getOnSaleProducts: catchAsync(async (req, res) => {
    const result = await productService.getOnSaleProducts();
    return sendSuccess(res, result, 'On sale products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Search products
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  searchProducts: catchAsync(async (req, res) => {
    const result = await productService.searchProducts(req.query.q, req.query.limit);
    return sendSuccess(res, result, 'Products found successfully', StatusCodes.OK);
  }),

  /**
   * Get related products
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getRelatedProducts: catchAsync(async (req, res) => {
    const { id } = req.params;

    const result = await productService.getRelatedProducts(id);

    return sendSuccess(res, result, 'Related products retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Update product by seller
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateProductBySeller: catchAsync(async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop._id;

    const product = await productService.updateProductBySeller(id, shopId, req.body, req.files);
    return sendSuccess(res, product, 'Product updated successfully', StatusCodes.OK);
  }),

  /**
   * Delete product by seller
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteProductBySeller: catchAsync(async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop._id;

    const product = await productService.deleteProductBySeller(id, shopId);
    return sendSuccess(res, product, 'Product deleted successfully', StatusCodes.OK);
  }),

  /**
   * Add variant by seller
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  addVariantBySeller: catchAsync(async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop._id;

    const product = await productService.addVariantBySeller(id, shopId, req.body, req.files);
    return sendSuccess(res, product, 'Variant added successfully', StatusCodes.CREATED);
  }),

  /**
   * Update variant by seller
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateVariantBySeller: catchAsync(async (req, res) => {
    const { id, variantId } = req.params;
    const shopId = req.shop._id;

    const product = await productService.updateVariantBySeller(id, shopId, variantId, req.body);
    return sendSuccess(res, product, 'Variant updated successfully', StatusCodes.OK);
  }),

  /**
   * Delete variant by seller
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteVariantBySeller: catchAsync(async (req, res) => {
    const { id, variantId } = req.params;
    const shopId = req.shop._id;

    const product = await productService.deleteVariantBySeller(id, shopId, variantId);
    return sendSuccess(res, product, 'Variant deleted successfully', StatusCodes.OK);
  }),
};

module.exports = ProductController;
