const express = require("express");
const router = express.Router();
const voucherController = require("../controllers/voucher.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createVoucherValidator, updateVoucherValidator } = require("../validations/voucher.validator");

/**
 * Public Routes
 */

/**
 * @route   GET /api/vouchers/platform
 * @desc    Get all active platform vouchers
 * @access  Public
 */
router.get("/platform", voucherController.getPlatformVouchers);

/**
 * @route   GET /api/vouchers/shop/:shopId
 * @desc    Get all active vouchers for a specific shop
 * @access  Public
 * @param   shopId - Shop ID to get vouchers for
 */
router.get("/shop/:shopId", voucherController.getShopVouchers);

/**
 * Authenticated Routes
 */

/**
 * @route   GET /api/vouchers/available
 * @desc    Get available vouchers for current user
 * @access  Private (Authenticated users)
 * @query   shopId - Optional shop ID to filter vouchers
 */
router.get("/available", verifyAccessToken, voucherController.getAvailableVouchers);

/**
 * @route   POST /api/vouchers/apply
 * @desc    Apply voucher to check discount amount
 * @access  Private (Authenticated users)
 * @body    { code, orderValue, shopId? }
 */
router.post("/apply", verifyAccessToken, voucherController.applyVoucher);

/**
 * Admin/Seller Routes
 */

/**
 * @route   GET /api/vouchers
 * @desc    Get all vouchers with pagination (Admin)
 * @access  Private (Admin only)
 * @query   page, limit, type, isActive, search
 */
router.get(
  "/",
  verifyAccessToken,
  requireRole(["admin"]),
  voucherController.getAllVouchers
);

/**
 * @route   GET /api/vouchers/statistics
 * @desc    Get voucher statistics overview
 * @access  Private (Admin only)
 */
router.get(
  "/statistics",
  verifyAccessToken,
  requireRole(["admin"]),
  voucherController.getVoucherStatistics
);

/**
 * @route   GET /api/vouchers/:id
 * @desc    Get voucher by ID
 * @access  Private (Authenticated users)
 * @param   id - Voucher ID
 */
router.get("/:id", verifyAccessToken, voucherController.getVoucherById);

/**
 * @route   POST /api/vouchers
 * @desc    Create a new voucher
 * @access  Private (Admin or Seller)
 * @body    { code, type, discountType, discountValue, minOrderValue?, maxDiscount?, startDate, endDate, usageLimit?, ... }
 */
router.post(
  "/",
  verifyAccessToken,
  validate(createVoucherValidator),
  voucherController.createVoucher
);

/**
 * @route   PUT /api/vouchers/:id
 * @desc    Update voucher by ID
 * @access  Private (Owner or Admin)
 * @param   id - Voucher ID to update
 * @body    { code?, discountType?, discountValue?, minOrderValue?, maxDiscount?, startDate?, endDate?, isActive?, ... }
 */
router.put(
  "/:id",
  verifyAccessToken,
  voucherController.updateVoucher
);

/**
 * @route   DELETE /api/vouchers/:id
 * @desc    Delete voucher (soft delete)
 * @access  Private (Owner or Admin)
 * @param   id - Voucher ID to delete
 */
router.delete(
  "/:id",
  verifyAccessToken,
  voucherController.deleteVoucher
);

/**
 * @route   DELETE /api/vouchers/:id/permanent
 * @desc    Permanently delete voucher
 * @access  Private (Admin only)
 * @param   id - Voucher ID to permanently delete
 */
router.delete(
  "/:id/permanent",
  verifyAccessToken,
  requireRole(["admin"]),
  voucherController.permanentDeleteVoucher
);

module.exports = router;
