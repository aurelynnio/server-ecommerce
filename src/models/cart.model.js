const { Schema, model, Types } = require('mongoose');

const priceSchema = new Schema(
  {
    currentPrice: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    currency: { type: String, default: 'VND' },
  },
  { _id: false },
);

const itemSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    shopId: {
      // Denormalized for easier grouping
      type: Types.ObjectId,
      ref: 'Shop',
      required: false, // Changed to false for backward compatibility
    },
    modelId: {
      // Replaces old variantId, refers to product.models._id
      type: Types.ObjectId,
      required: false, // if no variation
    },
    variantId: {
      // Refers to product.variants._id (color variant)
      type: Types.ObjectId,
      required: false,
    },
    size: {
      // Product-level size selection
      type: String,
      required: false,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    // Price stored as structured object
    price: {
      type: priceSchema,
      required: false,
    },
  },
  { _id: true }, // Enable _id for cart items
);

const cartSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [itemSchema],
    totalAmount: { type: Number, default: 0 },
    cartCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'carts',
  },
);

module.exports = model('Cart', cartSchema);
