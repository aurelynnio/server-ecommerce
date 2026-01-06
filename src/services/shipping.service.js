const ShippingTemplate = require("../models/shipping.template.model");
const Shop = require("../models/shop.model");

class ShippingService {
  async createTemplate(userId, templateData) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("No shop found for this user");

    const newTemplate = await ShippingTemplate.create({
      ...templateData,
      shop: shop._id,
    });

    return newTemplate;
  }

  async getMyTemplates(userId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("No shop found");

    const templates = await ShippingTemplate.find({ shop: shop._id });
    return templates;
  }

  async updateTemplate(userId, templateId, updates) {
    // Verify ownership via shop
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("Shop not found");

    const updated = await ShippingTemplate.findOneAndUpdate(
      { _id: templateId, shop: shop._id },
      updates,
      { new: true }
    );

    if (!updated)
      throw new Error("Template not found or access denied");

    return updated;
  }

  async deleteTemplate(userId, templateId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("Shop not found");

    const deleted = await ShippingTemplate.findOneAndDelete({
      _id: templateId,
      shop: shop._id,
    });
    if (!deleted) throw new Error("Template not found");

    return deleted;
  }
}

module.exports = new ShippingService();
