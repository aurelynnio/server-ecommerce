const { Schema, model, Types } = require("mongoose");

const shopFollowerSchema = new Schema(
  {
    shopId: { type: Types.ObjectId, ref: "Shop", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    collection: "shop_followers",
  }
);

// Compound unique: 1 user chi follow 1 shop 1 lan
shopFollowerSchema.index({ shopId: 1, userId: 1 }, { unique: true });
// Query: lay danh sach shops ma user dang follow
shopFollowerSchema.index({ userId: 1, createdAt: -1 });
// Query: dem so followers cua shop
shopFollowerSchema.index({ shopId: 1, createdAt: -1 });

module.exports = model("ShopFollower", shopFollowerSchema);
