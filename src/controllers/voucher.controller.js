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

* @access  Private (Admin or Seller)










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

* @access  Private (Authenticated users)


   */
  getVoucherById: catchAsync(async (req, res) => {
    const voucher = await voucherService.getVoucherById(req.params.id);
    return sendSuccess(res, voucher, "Voucher retrieved", StatusCodes.OK);
  }),

  /**
   * Get all vouchers with pagination

* @access  Private (Admin only)






   */
  getAllVouchers: catchAsync(async (req, res) => {
    const result = await voucherService.getAllVouchers(req.query);
    return sendSuccess(res, result, "Vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Update voucher by ID

* @access  Private (Owner or Admin)



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

* @access  Private (Owner or Admin)


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

* @access  Private (Admin only)


   */
  permanentDeleteVoucher: catchAsync(async (req, res) => {
    const result = await voucherService.permanentDeleteVoucher(req.params.id);
    return sendSuccess(res, result, "Voucher permanently deleted", StatusCodes.OK);
  }),

  /**
   * Get vouchers by shop

* @access  Public


   */
  getShopVouchers: catchAsync(async (req, res) => {
    const vouchers = await voucherService.getShopVouchers(req.params.shopId);
    return sendSuccess(res, vouchers, "Shop vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Get platform vouchers

* @access  Public

   */
  getPlatformVouchers: catchAsync(async (req, res) => {
    const vouchers = await voucherService.getPlatformVouchers();
    return sendSuccess(res, vouchers, "Platform vouchers retrieved", StatusCodes.OK);
  }),

  /**
   * Get available vouchers for current user

* @access  Private (Authenticated users)


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

* @access  Private (Authenticated users)




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

* @access  Private (Admin only)

   */
  getVoucherStatistics: catchAsync(async (req, res) => {
    const stats = await voucherService.getVoucherStatistics();
    return sendSuccess(res, stats, "Voucher statistics retrieved", StatusCodes.OK);
  }),
};

module.exports = VoucherController;
