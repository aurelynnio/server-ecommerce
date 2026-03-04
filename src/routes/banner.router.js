const express = require('express');

const BannerController = require('../controllers/banner.controller');

const upload = require('../configs/upload');
const { validateImageSignature } = require('../middlewares/uploadSignature.middleware');

const validate = require('../middlewares/validate.middleware');

const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');

const {
  createBannerValidator,
  updateBannerValidator,
  bannerIdParamValidator,
} = require('../validations/banner.validator');

const router = express.Router();

/**
 * Public Routes
 */
/**
 * @desc    Get active banners
 * @access  Public
 */
router.get('/', BannerController.getBanners);

/**
 * @desc    Get banner by ID
 * @access  Public
 */
router.get('/:id', validate({ params: bannerIdParamValidator }), BannerController.getBannerById);

/**
 * Admin Routes (Protected)
 */
/**
 * @desc    Create new banner
 * @access  Private (Admin only)
 */
router.post(
  '/',
  verifyAccessToken,
  requireRole('admin'),
  upload.single('image'),
  validateImageSignature,
  validate({ body: createBannerValidator }),
  BannerController.createBanner,
);

/**
 * @desc    Get all banners for admin
 * @access  Private (Admin only)
 */
router.get(
  '/admin/all',
  verifyAccessToken,
  requireRole('admin'),
  BannerController.getAllBannersAdmin,
);

/**
 * @desc    Update banner
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  verifyAccessToken,
  requireRole('admin'),
  upload.single('image'),
  validateImageSignature,
  validate({ params: bannerIdParamValidator, body: updateBannerValidator }),
  BannerController.updateBanner,
);

/**
 * @desc    Delete banner
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  verifyAccessToken,
  requireRole('admin'),
  validate({ params: bannerIdParamValidator }),
  BannerController.deleteBanner,
);

module.exports = router;
