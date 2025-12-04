const { Schema, model, Types } = require("mongoose");

const items = Schema({
  productId: {
    type: Types.ObjectId,
    ref: "Product",
    required: true,
  },
  variantId: {
    type: Types.ObjectId,
    required: false,
    ref: "Variant",
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  price: {
    currentPrice: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    currency: { type: String, default: "VND" },
  },
});

const cartSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [items],
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "carts",
  }
);

cartSchema.index({ userId: 1 }, { unique: true });
cartSchema.index({ updatedAt: -1 });


module.exports = model("Cart", cartSchema);
