const shippingService = require("../services/shipping.service");
const catchAsync = require("../configs/catchAsync");
const { sendSuccess } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Shipping Controller
 * Handles shipping template operations for sellers
 */
const ShippingController = {
  /**
   * Create a new shipping template

* @access  Private (Seller only)







   */
  createTemplate: catchAsync(async (req, res) => {
    const newTemplate = await shippingService.createTemplate(
      req.user.userId,
      req.body
    );
    return sendSuccess(
      res,
      newTemplate,
      "Shipping template created",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get all shipping templates for current seller's shop

* @access  Private (Seller only)

   */
  getMyTemplates: catchAsync(async (req, res) => {
    const templates = await shippingService.getMyTemplates(req.user.userId);
    return sendSuccess(res, templates, "Get templates success", StatusCodes.OK);
  }),

  /**
   * Update a shipping template

* @access  Private (Seller only - own templates)



   */
  updateTemplate: catchAsync(async (req, res) => {
    const updated = await shippingService.updateTemplate(
      req.user.userId,
      req.params.templateId,
      req.body
    );
    return sendSuccess(res, updated, "Template updated", StatusCodes.OK);
  }),

  /**
   * Delete a shipping template

* @access  Private (Seller only - own templates)


   */
  deleteTemplate: catchAsync(async (req, res) => {
    const deleted = await shippingService.deleteTemplate(
      req.user.userId,
      req.params.templateId
    );
    return sendSuccess(res, deleted, "Template deleted", StatusCodes.OK);
  }),
};

module.exports = ShippingController;
