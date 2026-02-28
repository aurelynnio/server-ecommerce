const ShippingTemplate = require("../models/shipping.template.model");

class ShippingTemplateRepository {
  create(payload) {
    return ShippingTemplate.create(payload);
  }

  findByShopId(shopId) {
    return ShippingTemplate.find({ shop: shopId });
  }

  findByIdAndShopIdAndUpdate(templateId, shopId, updates) {
    return ShippingTemplate.findOneAndUpdate(
      { _id: templateId, shop: shopId },
      updates,
      { new: true },
    );
  }

  findByIdAndShopIdAndDelete(templateId, shopId) {
    return ShippingTemplate.findOneAndDelete({
      _id: templateId,
      shop: shopId,
    });
  }
}

module.exports = new ShippingTemplateRepository();
