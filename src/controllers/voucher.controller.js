const voucherService = require("../services/voucher.service");
const catchAsync = require("../configs/catchAsync");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Voucher Controller
 * Handles voucher/coupon operations including CRUD, application, and statistics
 */
const VoucherController = {
  /**
   * Create a new voucher
   * @route POST /api/vouchers
   * @access Private (Admin or Seller)
   * @body {string} code - Voucher code
   * @body {string} type - Voucher type (platform/shop)
   * @body {string} discountType - Discount type (percentage/fixed)
   * @body {number} discountValue - Discount value
   * @body {number} [minOrderValue] - Minimum order value
   * @body {number} [maxDiscount] - Maximum discount amount
   * @body {Date} startDate - Start date
   * @body {Date} endDate - End date
   * @body {number} [usageLimit] - Usage limit
   * @returns {Object} Created voucher object
   */
  createVoucher: catchAsync(async (req, res) => {
    const newVoucher = await voucherService.createVoucher(
      req.user.userId,
      req.user.role ? [req.user.role] : ["user"],
      req.body
    );
    return sendSuccess(res, newVoucher, "Voucher created", StatusCodes.CREATED);
  }),

  /**
   * Get voucher by ID
   * @route GET /api/vouchers/:id
   * @access Private (Authenticated users)
   * @param {string} id - Voucher ID
   * @returns {Object} Voucher object
   */
  getVoucherById: catchAsync(async (req, res) => {
    const voucher = await voucherService.getVoucherById(req.params.id);
    return sendSuccess(res, voucher, "Voucher retrieved", StatusCodes.OK);
  }),

  /**
   * Get all vouchers with pagination
   * @route GET /api/vouchers
   * @access Private (Admin only)
   * @query {number} [page=1] - Page number
   * @query {number} [limit=10] - Items per page
   * @query {string} [type] - Filter by type
   * @query {boolean} [isActive] - Filter by active status
   * @query {string} [search] - Search by code
   * @returns {Object} Vouchers with pagination metadata
   */
  getAllVouchers: catchAsync(async (req, res) => {
    const result = await voucherService.getAllVouchers(req.query);
    return sendSuccess(res, result, "Vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Update voucher by ID
   * @route PUT /api/vouchers/:id
   * @access Private (Owner or Admin)
   * @param {string} id - Voucher ID to update
   * @body {Object} updateData - Fields to update
   * @returns {Object} Updated voucher object
   */
  updateVoucher: catchAsync(async (req, res) => {
    const voucher = await voucherService.updateVoucher(
      req.params.id,
      req.body,
      req.user.userId,
      req.user.role ? [req.user.role] : ["user"]
    );
    return sendSuccess(res, voucher, "Voucher updated", StatusCodes.OK);
  }),

  /**
   * Delete voucher (soft delete)
   * @route DELETE /api/vouchers/:id
   * @access Private (Owner or Admin)
   * @param {string} id - Voucher ID to delete
   * @returns {Object} Deletion confirmation
   */
  deleteVoucher: catchAsync(async (req, res) => {
    const result = await voucherService.deleteVoucher(
      req.params.id,
      req.user.userId,
      req.user.role ? [req.user.role] : ["user"]
    );
    return sendSuccess(res, result, "Voucher deleted", StatusCodes.OK);
  }),

  /**
   * Permanently delete voucher
   * @route DELETE /api/vouchers/:id/permanent
   * @access Private (Admin only)
   * @param {string} id - Voucher ID to permanently delete
   * @returns {Object} Deletion confirmation
   */
  permanentDeleteVoucher: catchAsync(async (req, res) => {
    const result = await voucherService.permanentDeleteVoucher(req.params.id);
    return sendSuccess(res, result, "Voucher permanently deleted", StatusCodes.OK);
  }),

  /**
   * Get vouchers by shop
   * @route GET /api/vouchers/shop/:shopId
   * @access Public
   * @param {string} shopId - Shop ID
   * @returns {Array} Shop vouchers
   */
  getShopVouchers: catchAsync(async (req, res) => {
    const vouchers = await voucherService.getShopVouchers(req.params.shopId);
    return sendSuccess(res, vouchers, "Shop vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Get platform vouchers
   * @route GET /api/vouchers/platform
   * @access Public
   * @returns {Array} Platform vouchers
   */
  getPlatformVouchers: catchAsync(async (req, res) => {
    const vouchers = await voucherService.getPlatformVouchers();
    return sendSuccess(res, vouchers, "Platform vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Get available vouchers for current user
   * @route GET /api/vouchers/available
   * @access Private (Authenticated users)
   * @query {string} [shopId] - Optional shop ID to filter
   * @returns {Array} Available vouchers
   */
  getAvailableVouchers: catchAsync(async (req, res) => {
    const { shopId } = req.query;
    const vouchers = await voucherService.getAvailableVouchers(
      req.user.userId,
      shopId
    );
    return sendSuccess(res, vouchers, "Available vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Apply voucher to check discount amount
   * @route POST /api/vouchers/apply
   * @access Private (Authenticated users)
   * @body {string} code - Voucher code
   * @body {number} orderValue - Order value to apply discount
   * @body {string} [shopId] - Shop ID for shop vouchers
   * @returns {Object} Discount calculation result
   */
  applyVoucher: catchAsync(async (req, res) => {
    const { code, orderValue, shopId } = req.body;
    const result = await voucherService.applyVoucher(
      code,
      req.user.userId,
      orderValue,
      shopId
    );
    return sendSuccess(res, result, "Voucher applied", StatusCodes.OK);
  }),

  /**
   * Get voucher statistics overview
   * @route GET /api/vouchers/statistics
   * @access Private (Admin only)
   * @returns {Object} Voucher statistics (total, active, expired, usage, etc.)
   */
  getVoucherStatistics: catchAsync(async (req, res) => {
    const stats = await voucherService.getVoucherStatistics();
    return sendSuccess(res, stats, "Voucher statistics retrieved", StatusCodes.OK);
  }),
};

module.exports = VoucherController;
