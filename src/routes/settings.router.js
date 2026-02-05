
const express = require("express");

const router = express.Router();

const settingsController = require("../controllers/settings.controller");

const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");

/**
 * All routes require admin access
 */
/**
 * @desc    Get all settings
 * @access  Private (Admin only)
 */
router.get(
  "/",
  verifyAccessToken,
  requireRole(["admin"]),
  settingsController.getSettings,
);

/**
 * @desc    Update settings (partial update)
 * @access  Private (Admin only)
 * @body    { store?, notifications?, display?, business? }
 */
router.put(
  "/",
  verifyAccessToken,
  requireRole(["admin"]),
  settingsController.updateSettings,
);

/**
 * @desc    Reset settings to default
 * @access  Private (Admin only)
 */
router.post(
  "/reset",
  verifyAccessToken,
  requireRole(["admin"]),
  settingsController.resetSettings,
);

/**
 * @desc    Get specific settings section
 * @access  Private (Admin only)
 * @param   section - store, notifications, display, business
 */
router.get(
  "/:section",
  verifyAccessToken,
  requireRole(["admin"]),
  settingsController.getSection,
);

/**
 * @desc    Update specific settings section
 * @access  Private (Admin only)
 * @param   section - store, notifications, display, business
 */
router.put(
  "/:section",
  verifyAccessToken,
  requireRole(["admin"]),
  settingsController.updateSection,
);

module.exports = router;
