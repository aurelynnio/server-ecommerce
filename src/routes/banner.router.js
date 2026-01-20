
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
* @desc Get active banners
* @accessPublic
 */

router.get("/", BannerController.getBanners);
/**
* @desc Get banner by ID
* @accessPublic
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
* @desc Create new banner
* @accessPrivate (Admin only)
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
* @desc Get all banners for admin
* @accessPrivate (Admin only)
 */

router.get(
  "/admin/all",
  verifyAccessToken,
  requireRole("admin"),
  BannerController.getAllBannersAdmin
);
/**
* @desc Update banner
* @accessPrivate (Admin only)
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
* @desc Delete banner
* @accessPrivate (Admin only)
 */

router.delete(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: bannerIdParamValidator }),
  BannerController.deleteBanner
);

module.exports = router;
