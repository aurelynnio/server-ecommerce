const { Schema, model, Types } = require("mongoose");

const wishlistSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
  },
  {
    timestamps: true,
    collection: "wishlists",
  }
);

// Compound unique: 1 user chi add 1 product 1 lan
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });
// Query: lay wishlist cua user (sorted by newest)
wishlistSchema.index({ userId: 1, createdAt: -1 });
// Query: dem so luot yeu thich cua product
wishlistSchema.index({ productId: 1 });

module.exports = model("Wishlist", wishlistSchema);
