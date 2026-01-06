const { Schema, model, Types } = require("mongoose");

const priceSchema = new Schema(
  {
    currentPrice: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    currency: { type: String, default: "VND" },
  },
  { _id: false }
);

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
      required: false, // Changed to false for backward compatibility
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
    // Price can be Number (old) or Object (new)
    price: {
      type: Schema.Types.Mixed, // Allow both Number and Object
      required: false,
    },
  },
  { _id: true } // Enable _id for cart items
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
    totalAmount: { type: Number, default: 0 },
    cartCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "carts",
  }
);

module.exports = model("Cart", cartSchema);
