const express = require("express");
const router = express.Router();
const shopController = require("../controllers/shop.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createShopValidator,
  updateShopValidator,
} = require("../validations/shop.validator");

/**
 * @route   POST /api/shops/register
 * @desc    Register a new shop (become a seller)
 * @access  Private (Authenticated users)
 * @body    { name, description?, logo?, address?, phone?, email? }
 */
router.post(
  "/register",
  verifyAccessToken,
  validate(createShopValidator),
  shopController.createShop
);

/**
 * @route   GET /api/shops/me
 * @desc    Get current user's shop information
 * @access  Private (Seller only)
 */
router.get(
  "/me",
  verifyAccessToken,
  requireRole("seller"),
  shopController.getMyShop
);

/**
 * @route   PUT /api/shops
 * @desc    Update current user's shop information
 * @access  Private (Seller only)
 * @body    { name?, description?, logo?, address?, phone?, email?, isActive? }
 */
router.put(
  "/",
  verifyAccessToken,
  requireRole("seller"),
  validate(updateShopValidator),
  shopController.updateShop
);

/**
 * @route   GET /api/shops/:shopId
 * @desc    Get shop information by ID
 * @access  Public
 * @param   shopId - Shop ID
 */
router.get("/:shopId", shopController.getShopInfo);

module.exports = router;
