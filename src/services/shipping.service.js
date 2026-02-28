const shippingTemplateRepository = require("../repositories/shipping-template.repository");
const shopRepository = require("../repositories/shop.repository");
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
    const shop = await shopRepository.findByOwnerId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No shop found for this user");
    }


    const newTemplate = await shippingTemplateRepository.create({
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
    const shop = await shopRepository.findByOwnerId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No shop found");
    }


    const templates = await shippingTemplateRepository.findByShopId(shop._id);
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
    const shop = await shopRepository.findByOwnerId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }


    const updated = await shippingTemplateRepository.findByIdAndShopIdAndUpdate(
      templateId,
      shop._id,
      updates,
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
    const shop = await shopRepository.findByOwnerId(userId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }


    const deleted = await shippingTemplateRepository.findByIdAndShopIdAndDelete(
      templateId,
      shop._id,
    );
    if (!deleted) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Template not found");
    }


    return deleted;
  }
}

module.exports = new ShippingService();
