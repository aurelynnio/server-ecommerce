const settingsService = require("../services/settings.service");
const catchAsync = require("../configs/catchAsync");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Settings Controller
 * Handles system settings management (Admin only)
 */
const SettingsController = {
  /**
   * Get all settings

* @access  Private (Admin only)
   */
  getSettings: catchAsync(async (req, res) => {
    const settings = await settingsService.getSettings();
    return sendSuccess(res, settings, "Get settings success", StatusCodes.OK);
  }),

  /**
   * Update settings (partial update)

* @access  Private (Admin only)

   */
  updateSettings: catchAsync(async (req, res) => {
    const settings = await settingsService.updateSettings(
      req.body,
      req.user.userId,
    );
    return sendSuccess(
      res,
      settings,
      "Settings updated successfully",
      StatusCodes.OK,
    );
  }),

  /**
   * Get specific settings section

* @access  Private (Admin only)

   */
  getSection: catchAsync(async (req, res) => {
    const { section } = req.params;
    const data = await settingsService.getSection(section);
    return sendSuccess(res, data, "Get section success", StatusCodes.OK);
  }),

  /**
   * Update specific settings section

* @access  Private (Admin only)

   */
  updateSection: catchAsync(async (req, res) => {
    const { section } = req.params;
    const settings = await settingsService.updateSection(
      section,
      req.body,
      req.user.userId,
    );
    return sendSuccess(
      res,
      settings,
      "Section updated successfully",
      StatusCodes.OK,
    );
  }),

  /**
   * Reset settings to default

* @access  Private (Admin only)
   */
  resetSettings: catchAsync(async (req, res) => {
    const settings = await settingsService.resetSettings(req.user.userId);
    return sendSuccess(
      res,
      settings,
      "Settings reset to default",
      StatusCodes.OK,
    );
  }),
};

module.exports = SettingsController;
