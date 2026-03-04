const express = require('express');

const router = express.Router();

const voucherController = require('../controllers/voucher.controller');

const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');

const validate = require('../middlewares/validate.middleware');

const { createVoucherValidator } = require('../validations/voucher.validator');

/**
 * @desc    Get platform vouchers
 * @access  Public
 */
router.get('/platform', voucherController.getPlatformVouchers);

/**
 * @desc    Get vouchers for a shop
 * @access  Public
 * @param   shopId - Shop ID
 */
router.get('/shop/:shopId', voucherController.getShopVouchers);

/**
 * @desc    Get available vouchers for current user
 * @access  Private
 */
router.get('/available', verifyAccessToken, voucherController.getAvailableVouchers);

/**
 * @desc    Apply voucher to current cart/order
 * @access  Private
 */
router.post('/apply', verifyAccessToken, voucherController.applyVoucher);

/**
 * @desc    Get all vouchers (Admin)
 * @access  Private (Admin)
 */
router.get('/', verifyAccessToken, requireRole(['admin']), voucherController.getAllVouchers);

/**
 * @desc    Get voucher statistics (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/statistics',
  verifyAccessToken,
  requireRole(['admin']),
  voucherController.getVoucherStatistics,
);

/**
 * @desc    Get voucher by ID
 * @access  Private
 * @param   id - Voucher ID
 */
router.get('/:id', verifyAccessToken, voucherController.getVoucherById);

/**
 * @desc    Create voucher
 * @access  Private
 */
router.post(
  '/',
  verifyAccessToken,
  validate(createVoucherValidator),
  voucherController.createVoucher,
);

/**
 * @desc    Update voucher
 * @access  Private
 * @param   id - Voucher ID
 */
router.put('/:id', verifyAccessToken, voucherController.updateVoucher);

/**
 * @desc    Delete voucher (soft delete)
 * @access  Private
 * @param   id - Voucher ID
 */
router.delete('/:id', verifyAccessToken, voucherController.deleteVoucher);

/**
 * @desc    Delete voucher permanently (Admin)
 * @access  Private (Admin)
 * @param   id - Voucher ID
 */
router.delete(
  '/:id/permanent',
  verifyAccessToken,
  requireRole(['admin']),
  voucherController.permanentDeleteVoucher,
);

module.exports = router;
