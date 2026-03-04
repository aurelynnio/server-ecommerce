const shippingService = require('../services/shipping.service');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const ShippingController = {
  /**
   * Create template
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createTemplate: catchAsync(async (req, res) => {
    const newTemplate = await shippingService.createTemplate(req.user.userId, req.body);
    return sendSuccess(res, newTemplate, 'Shipping template created', StatusCodes.CREATED);
  }),

  /**
   * Get my templates
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getMyTemplates: catchAsync(async (req, res) => {
    const templates = await shippingService.getMyTemplates(req.user.userId);
    return sendSuccess(res, templates, 'Get templates success', StatusCodes.OK);
  }),

  /**
   * Update template
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateTemplate: catchAsync(async (req, res) => {
    const updated = await shippingService.updateTemplate(
      req.user.userId,
      req.params.templateId,
      req.body,
    );
    return sendSuccess(res, updated, 'Template updated', StatusCodes.OK);
  }),

  /**
   * Delete template
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteTemplate: catchAsync(async (req, res) => {
    const deleted = await shippingService.deleteTemplate(req.user.userId, req.params.templateId);
    return sendSuccess(res, deleted, 'Template deleted', StatusCodes.OK);
  }),
};

module.exports = ShippingController;
