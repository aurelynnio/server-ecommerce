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
const upload = require("../configs/upload");

/**
 * Admin Routes (must be before :shopId route)
 */

/**
 * @route   GET /api/shops/admin/all
 * @desc    Get all shops with pagination (Admin)
 * @access  Private (Admin only)
 * @query   page, limit, status, search, sort
 */
router.get(
  "/admin/all",
  verifyAccessToken,
  requireRole(["admin"]),
  shopController.getAllShops
);

/**
 * @route   PUT /api/shops/admin/:shopId/status
 * @desc    Update shop status (Admin)
 * @access  Private (Admin only)
 * @param   shopId - Shop ID
 * @body    { status }
 */
router.put(
  "/admin/:shopId/status",
  verifyAccessToken,
  requireRole(["admin"]),
  shopController.updateShopStatus
);

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
 * @route   POST /api/shops/upload-register-image
 * @desc    Upload image for shop registration (logo or banner)
 * @access  Private (Authenticated users - for registration)
 * @body    { type: "logo" | "banner" }
 */
router.post(
  "/upload-register-image",
  verifyAccessToken,
  upload.single("image"),
  shopController.uploadImage
);

/**
 * @route   GET /api/shops/me
 * @desc    Get current user's shop information
 * @access  Private (Seller or Admin)
 */
router.get(
  "/me",
  verifyAccessToken,
  requireRole("seller", "admin"),
  shopController.getMyShop
);

/**
 * @route   PUT /api/shops
 * @desc    Update current user's shop information
 * @access  Private (Seller or Admin)
 * @body    { name?, description?, logo?, address?, phone?, email?, isActive? }
 */
router.put(
  "/",
  verifyAccessToken,
  requireRole("seller", "admin"),
  validate(updateShopValidator),
  shopController.updateShop
);

/**
 * @route   POST /api/shops/upload-image
 * @desc    Upload shop image (logo or banner)
 * @access  Private (Seller or Admin)
 * @body    { type: "logo" | "banner" }
 */
router.post(
  "/upload-image",
  verifyAccessToken,
  requireRole("seller", "admin"),
  upload.single("image"),
  shopController.uploadImage
);

/**
 * @route   GET /api/shops/slug/:slug
 * @desc    Get shop information by slug
 * @access  Public
 * @param   slug - Shop slug
 */
router.get("/slug/:slug", shopController.getShopBySlug);

/**
 * @route   GET /api/shops/:shopId
 * @desc    Get shop information by ID
 * @access  Public
 * @param   shopId - Shop ID
 */
router.get("/:shopId", shopController.getShopInfo);

module.exports = router;
