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
 * @desc    Get all public shops (active only)
 * @access  Public
 */
router.get("/", shopController.getPublicShops);

/**
 * @desc    Get all shops with pagination (Admin)
 * @access  Private (Admin)
 */
router.get(
  "/admin/all",
  verifyAccessToken,
  requireRole(["admin"]),
  shopController.getAllShops,
);

/**
 * @desc    Update shop status (Admin)
 * @access  Private (Admin)
 */
router.put(
  "/admin/:shopId/status",
  verifyAccessToken,
  requireRole(["admin"]),
  shopController.updateShopStatus,
);

/**
 * @desc    Register a new shop (become a seller)
 * @access  Private
 */
router.post(
  "/register",
  verifyAccessToken,
  validate(createShopValidator),
  shopController.createShop,
);

/**
 * @desc    Upload image for shop registration (logo or banner)
 * @access  Private
 */
router.post(
  "/upload-register-image",
  verifyAccessToken,
  upload.single("image"),
  shopController.uploadImage,
);

/**
 * @desc    Get shop statistics for seller dashboard
 * @access  Private (Seller/Admin)
 */
router.get(
  "/statistics",
  verifyAccessToken,
  requireRole("seller", "admin"),
  shopController.getShopStatistics,
);

/**
 * @desc    Get current user's shop information
 * @access  Private (Seller/Admin)
 */
router.get(
  "/me",
  verifyAccessToken,
  requireRole("seller", "admin"),
  shopController.getMyShop,
);

/**
 * @desc    Get current user's shop information (Alias for /me)
 * @access  Private (Seller/Admin)
 */
router.get(
  "/my",
  verifyAccessToken,
  requireRole("seller", "admin"),
  shopController.getMyShop,
);

/**
 * @desc    Update current user's shop information
 * @access  Private (Seller/Admin)
 */
router.put(
  "/",
  verifyAccessToken,
  requireRole("seller", "admin"),
  validate(updateShopValidator),
  shopController.updateShop,
);

/**
 * @desc    Upload shop image (logo or banner)
 * @access  Private (Seller/Admin)
 */
router.post(
  "/upload-image",
  verifyAccessToken,
  requireRole("seller", "admin"),
  upload.single("image"),
  shopController.uploadImage,
);

/**
 * @desc    Get shop information by slug
 * @access  Public
 */
router.get("/slug/:slug", shopController.getShopBySlug);

/**
 * @desc    Get shop information by ID
 * @access  Public
 */
router.get("/:shopId", shopController.getShopInfo);

module.exports = router;
