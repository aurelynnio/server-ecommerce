const { Schema, model, Types } = require("mongoose");

const shopCategorySchema = new Schema(
  {
    shopId: { type: Types.ObjectId, ref: "Shop", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "shop_categories",
  }
);

shopCategorySchema.index({ shopId: 1 });
shopCategorySchema.index({ shopId: 1, displayOrder: 1 });

module.exports = model("ShopCategory", shopCategorySchema);
