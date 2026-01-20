
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
* @desc Get all active platform vouchers
* @accessPublic
 */

router.get("/platform", voucherController.getPlatformVouchers);
/**
* @desc Get all active vouchers for a specific shop
* @accessPublic
 * @param   shopId - Shop ID to get vouchers for
 */

router.get("/shop/:shopId", voucherController.getShopVouchers);
/**
 * Authenticated Routes
 */
/**
* @desc Get available vouchers for current user
* @accessPrivate (Authenticated users)
 * @query   shopId - Optional shop ID to filter vouchers
 */

router.get("/available", verifyAccessToken, voucherController.getAvailableVouchers);
/**
* @desc Apply voucher to check discount amount
* @accessPrivate (Authenticated users)
 * @body    { code, orderValue, shopId? }
 */

router.post("/apply", verifyAccessToken, voucherController.applyVoucher);
/**
 * Admin/Seller Routes
 */
/**
* @desc Get all vouchers with pagination (Admin)
* @accessPrivate (Admin only)
 * @query   page, limit, type, isActive, search
 */

router.get(
  "/",
  verifyAccessToken,
  requireRole(["admin"]),
  voucherController.getAllVouchers
);
/**
* @desc Get voucher statistics overview
* @accessPrivate (Admin only)
 */

router.get(
  "/statistics",
  verifyAccessToken,
  requireRole(["admin"]),
  voucherController.getVoucherStatistics
);
/**
* @desc Get voucher by ID
* @accessPrivate (Authenticated users)
 * @param   id - Voucher ID
 */

router.get("/:id", verifyAccessToken, voucherController.getVoucherById);
/**
* @desc Create a new voucher
* @accessPrivate (Admin or Seller)
 * @body    { code, type, discountType, discountValue, minOrderValue?, maxDiscount?, startDate, endDate, usageLimit?, ... }
 */

router.post(
  "/",
  verifyAccessToken,
  validate(createVoucherValidator),
  voucherController.createVoucher
);
/**
* @desc Update voucher by ID
* @accessPrivate (Owner or Admin)
 * @param   id - Voucher ID to update
 * @body    { code?, discountType?, discountValue?, minOrderValue?, maxDiscount?, startDate?, endDate?, isActive?, ... }
 */

router.put(
  "/:id",
  verifyAccessToken,
  voucherController.updateVoucher
);
/**
* @desc Delete voucher (soft delete)
* @accessPrivate (Owner or Admin)
 * @param   id - Voucher ID to delete
 */

router.delete(
  "/:id",
  verifyAccessToken,
  voucherController.deleteVoucher
);
/**
* @desc Permanently delete voucher
* @accessPrivate (Admin only)
 * @param   id - Voucher ID to permanently delete
 */

router.delete(
  "/:id/permanent",
  verifyAccessToken,
  requireRole(["admin"]),
  voucherController.permanentDeleteVoucher
);

module.exports = router;
