const voucherService = require('../services/voucher.service');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const VoucherController = {
  /**
   * Create voucher
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createVoucher: catchAsync(async (req, res) => {
    const newVoucher = await voucherService.createVoucher(
      req.user.userId,
      req.user.role ? [req.user.role] : ['user'],
      req.body,
    );
    return sendSuccess(res, newVoucher, 'Voucher created', StatusCodes.CREATED);
  }),

  /**
   * Get voucher by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getVoucherById: catchAsync(async (req, res) => {
    const voucher = await voucherService.getVoucherById(req.params.id);
    return sendSuccess(res, voucher, 'Voucher retrieved', StatusCodes.OK);
  }),

  /**
   * Get all vouchers
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getAllVouchers: catchAsync(async (req, res) => {
    const result = await voucherService.getAllVouchers(req.query);
    return sendSuccess(res, result, 'Vouchers retrieved', StatusCodes.OK);
  }),

  /**
   * Update voucher
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateVoucher: catchAsync(async (req, res) => {
    const voucher = await voucherService.updateVoucher(
      req.params.id,
      req.body,
      req.user.userId,
      req.user.role ? [req.user.role] : ['user'],
    );
    return sendSuccess(res, voucher, 'Voucher updated', StatusCodes.OK);
  }),

  /**
   * Delete voucher
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteVoucher: catchAsync(async (req, res) => {
    const result = await voucherService.deleteVoucher(
      req.params.id,
      req.user.userId,
      req.user.role ? [req.user.role] : ['user'],
    );
    return sendSuccess(res, result, 'Voucher deleted', StatusCodes.OK);
  }),

  /**
   * Permanent delete voucher
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  permanentDeleteVoucher: catchAsync(async (req, res) => {
    const result = await voucherService.permanentDeleteVoucher(req.params.id);
    return sendSuccess(res, result, 'Voucher permanently deleted', StatusCodes.OK);
  }),

  /**
   * Get shop vouchers
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getShopVouchers: catchAsync(async (req, res) => {
    const vouchers = await voucherService.getShopVouchers(req.params.shopId);
    return sendSuccess(res, vouchers, 'Shop vouchers retrieved', StatusCodes.OK);
  }),

  /**
   * Get platform vouchers
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getPlatformVouchers: catchAsync(async (req, res) => {
    const vouchers = await voucherService.getPlatformVouchers();
    return sendSuccess(res, vouchers, 'Platform vouchers retrieved', StatusCodes.OK);
  }),

  /**
   * Get available vouchers
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getAvailableVouchers: catchAsync(async (req, res) => {
    const { shopId } = req.query;
    const vouchers = await voucherService.getAvailableVouchers(req.user.userId, shopId);
    return sendSuccess(res, vouchers, 'Available vouchers retrieved', StatusCodes.OK);
  }),

  /**
   * Apply voucher
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  applyVoucher: catchAsync(async (req, res) => {
    const { code, orderValue, shopId } = req.body;
    const result = await voucherService.applyVoucher(code, req.user.userId, orderValue, shopId);
    return sendSuccess(res, result, 'Voucher applied', StatusCodes.OK);
  }),

  /**
   * Get voucher statistics
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getVoucherStatistics: catchAsync(async (req, res) => {
    const stats = await voucherService.getVoucherStatistics();
    return sendSuccess(res, stats, 'Voucher statistics retrieved', StatusCodes.OK);
  }),
};

module.exports = VoucherController;
