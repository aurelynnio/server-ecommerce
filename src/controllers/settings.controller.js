const settingsService = require('../services/settings.service');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const SettingsController = {
  /**
   * Get settings
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSettings: catchAsync(async (req, res) => {
    const settings = await settingsService.getSettings();
    return sendSuccess(res, settings, 'Get settings success', StatusCodes.OK);
  }),

  /**
   * Update settings
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateSettings: catchAsync(async (req, res) => {
    const settings = await settingsService.updateSettings(req.body, req.user.userId);
    return sendSuccess(res, settings, 'Settings updated successfully', StatusCodes.OK);
  }),

  /**
   * Get section
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSection: catchAsync(async (req, res) => {
    const { section } = req.params;
    const data = await settingsService.getSection(section);
    return sendSuccess(res, data, 'Get section success', StatusCodes.OK);
  }),

  /**
   * Update section
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateSection: catchAsync(async (req, res) => {
    const { section } = req.params;
    const settings = await settingsService.updateSection(section, req.body, req.user.userId);
    return sendSuccess(res, settings, 'Section updated successfully', StatusCodes.OK);
  }),

  /**
   * Reset settings
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  resetSettings: catchAsync(async (req, res) => {
    const settings = await settingsService.resetSettings(req.user.userId);
    return sendSuccess(res, settings, 'Settings reset to default', StatusCodes.OK);
  }),
};

module.exports = SettingsController;
