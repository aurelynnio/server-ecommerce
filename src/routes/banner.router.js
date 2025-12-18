const express = require("express");
const BannerController = require("../controllers/banner.controller");
const upload = require("../configs/upload");
const validate = require("../middlewares/validate.middleware");
const {
  createBannerValidator,
  updateBannerValidator,
  bannerIdParamValidator,
} = require("../validations/banner.validator");

const router = express.Router();

// Public routes
router.get("/", BannerController.getBanners);
router.get(
  "/:id",
  validate({ params: bannerIdParamValidator }),
  BannerController.getBannerById
);

// Admin routes (TODO: Add auth middlewares)
router.post(
  "/",
  upload.single("image"),
  validate({ body: createBannerValidator }),
  BannerController.createBanner
);
router.get("/admin/all", BannerController.getAllBannersAdmin);
router.put(
  "/:id",
  upload.single("image"),
  validate({ params: bannerIdParamValidator, body: updateBannerValidator }),
  BannerController.updateBanner
);
router.delete(
  "/:id",
  validate({ params: bannerIdParamValidator }),
  BannerController.deleteBanner
);

module.exports = router;
