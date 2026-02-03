const ShippingTemplate = require("../models/shipping.template.model");
const Shop = require("../models/shop.model");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");


class ShippingService {
  /**
   * Create template
   * @param {string} userId
   * @param {any} templateData
   * @returns {Promise<any>}
   */
  async createTemplate(userId, templateData) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No shop found for this user");
    }


    const newTemplate = await ShippingTemplate.create({
      ...templateData,
      shop: shop._id,
    });

    return newTemplate;
  }

  /**
   * Get my templates
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getMyTemplates(userId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No shop found");
    }


    const templates = await ShippingTemplate.find({ shop: shop._id });
    return templates;
  }

  /**
   * Update template
   * @param {string} userId
   * @param {string} templateId
   * @param {Object} updates
   * @returns {Promise<any>}
   */
  async updateTemplate(userId, templateId, updates) {
    // Verify ownership via shop
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }


    const updated = await ShippingTemplate.findOneAndUpdate(
      { _id: templateId, shop: shop._id },
      updates,
      { new: true }
    );

    if (!updated) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Template not found or access denied"
      );
    }


    return updated;
  }

  /**
   * Delete template
   * @param {string} userId
   * @param {string} templateId
   * @returns {Promise<any>}
   */
  async deleteTemplate(userId, templateId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }


    const deleted = await ShippingTemplate.findOneAndDelete({
      _id: templateId,
      shop: shop._id,
    });
    if (!deleted) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Template not found");
    }


    return deleted;
  }
}

module.exports = new ShippingService();
