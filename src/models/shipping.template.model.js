const { Schema, model, Types } = require('mongoose');

const shippingRuleSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g: "Standard"
    type: {
      type: String,
      enum: ['fixed', 'weight_based', 'quantity_based'],
      default: 'fixed',
    },
    baseFee: { type: Number, required: true, min: 0 },

    // For weight/quantity based:
    stepUnit: { type: Number, default: 0 }, // e.g., every 1kg
    stepFee: { type: Number, default: 0 }, // add 10k

    // Regional restrictions or specific pricing could go here in v2
    // e.g. regions: [{ code: 'HN', fee: 20000 }]
  },
  { _id: true },
);

const shippingTemplateSchema = new Schema(
  {
    shop: { type: Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true }, // e.g. "Free ship for light items"
    isDefault: { type: Boolean, default: false },
    rules: [shippingRuleSchema],
  },
  {
    timestamps: true,
    collection: 'shipping_templates',
  },
);

shippingTemplateSchema.index({ shop: 1 });

module.exports = model('ShippingTemplate', shippingTemplateSchema);
