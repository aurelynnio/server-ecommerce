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
   * @route POST /api/shipping
   * @access Private (Seller only)
   * @body {string} name - Template name
   * @body {string} [description] - Template description
   * @body {number} baseFee - Base shipping fee
   * @body {number} [freeShippingThreshold] - Order value for free shipping
   * @body {number} estimatedDays - Estimated delivery days
   * @body {Array} [regions] - Supported regions
   * @returns {Object} Created shipping template
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
   * @route GET /api/shipping
   * @access Private (Seller only)
   * @returns {Array} Seller's shipping templates
   */
  getMyTemplates: catchAsync(async (req, res) => {
    const templates = await shippingService.getMyTemplates(req.user.userId);
    return sendSuccess(res, templates, "Get templates success", StatusCodes.OK);
  }),

  /**
   * Update a shipping template
   * @route PUT /api/shipping/:templateId
   * @access Private (Seller only - own templates)
   * @param {string} templateId - Shipping template ID
   * @body {Object} updateData - Fields to update
   * @returns {Object} Updated shipping template
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
   * @route DELETE /api/shipping/:templateId
   * @access Private (Seller only - own templates)
   * @param {string} templateId - Shipping template ID to delete
   * @returns {Object} Deletion confirmation
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
