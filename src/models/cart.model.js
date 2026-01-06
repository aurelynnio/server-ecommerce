const { Schema, model, Types } = require("mongoose");

const itemSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: "Product",
      required: true,
    },
    shopId: {
      // Denormalized for easier grouping
      type: Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    modelId: {
      // Replaces old variantId, refers to product.models._id
      type: Types.ObjectId,
      required: false, // if no variation
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    // Cached info (optional)
    price: { type: Number }, // current price
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [itemSchema],
    // Total amount is usually calculated on fly, but can cache here
    cartCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "carts",
  }
);

module.exports = model("Cart", cartSchema);
