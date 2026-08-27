const express = require('express');

const router = express.Router();

const settingsController = require('../controllers/settings.controller');

const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');

// All settings routes require admin access
router.use(verifyAccessToken, requireRole('admin'));

/**
 * @desc    Get all settings
 * @access  Private (Admin only)
 */
router.get('/', settingsController.getSettings);

/**
 * @desc    Update settings (partial update)
 * @access  Private (Admin only)
 * @body    { store?, notifications?, display?, business? }
 */
router.put('/', settingsController.updateSettings);

/**
 * @desc    Reset settings to default
 * @access  Private (Admin only)
 */
router.post('/reset', settingsController.resetSettings);

/**
 * @desc    Get specific settings section
 * @access  Private (Admin only)
 * @param   section - store, notifications, display, business
 */
router.get('/:section', settingsController.getSection);

/**
 * @desc    Update specific settings section
 * @access  Private (Admin only)
 * @param   section - store, notifications, display, business
 */
router.put('/:section', settingsController.updateSection);

module.exports = router;
