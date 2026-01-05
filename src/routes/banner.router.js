const express = require("express");
const BannerController = require("../controllers/banner.controller");
const upload = require("../configs/upload");
const validate = require("../middlewares/validate.middleware");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const {
  createBannerValidator,
  updateBannerValidator,
  bannerIdParamValidator,
} = require("../validations/banner.validator");

const router = express.Router();

/**
 * Public Routes
 */

/**
 * @route   GET /api/banners
 * @desc    Get active banners
 * @access  Public
 */
router.get("/", BannerController.getBanners);

/**
 * @route   GET /api/banners/:id
 * @desc    Get banner by ID
 * @access  Public
 */
router.get(
  "/:id",
  validate({ params: bannerIdParamValidator }),
  BannerController.getBannerById
);

/**
 * Admin Routes (Protected)
 */

/**
 * @route   POST /api/banners
 * @desc    Create new banner
 * @access  Private (Admin only)
 */
router.post(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  upload.single("image"),
  validate({ body: createBannerValidator }),
  BannerController.createBanner
);

/**
 * @route   GET /api/banners/admin/all
 * @desc    Get all banners for admin
 * @access  Private (Admin only)
 */
router.get(
  "/admin/all",
  verifyAccessToken,
  requireRole("admin"),
  BannerController.getAllBannersAdmin
);

/**
 * @route   PUT /api/banners/:id
 * @desc    Update banner
 * @access  Private (Admin only)
 */
router.put(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  upload.single("image"),
  validate({ params: bannerIdParamValidator, body: updateBannerValidator }),
  BannerController.updateBanner
);

/**
 * @route   DELETE /api/banners/:id
 * @desc    Delete banner
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: bannerIdParamValidator }),
  BannerController.deleteBanner
);

module.exports = router;
