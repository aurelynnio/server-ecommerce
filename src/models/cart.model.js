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

// Pre-validate hook to guarantee totalAmount & cartCount are always valid non-negative numbers
cartSchema.pre('validate', function () {
  if (
    this.totalAmount === undefined ||
    this.totalAmount === null ||
    typeof this.totalAmount !== 'number' ||
    Number.isNaN(this.totalAmount)
  ) {
    this.totalAmount = 0;
  } else {
    this.totalAmount = Math.max(0, this.totalAmount);
  }

  if (
    this.cartCount === undefined ||
    this.cartCount === null ||
    typeof this.cartCount !== 'number' ||
    Number.isNaN(this.cartCount)
  ) {
    this.cartCount = Array.isArray(this.items)
      ? this.items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)
      : 0;
  }
});

// Khóa truy vấn chính: Mỗi user chỉ có đúng 1 giỏ hàng duy nhất (O(log N))
// Các thao tác trên items được xử lý in-memory qua `cart.items` rồi save(),
// không có truy vấn DB nào lọc theo items._id / items.productId / items.shopId.
cartSchema.index({ userId: 1 }, { unique: true });

module.exports = model('Cart', cartSchema);
