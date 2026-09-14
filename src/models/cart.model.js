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

// 1. Khóa truy vấn chính: Mỗi user chỉ có đúng 1 giỏ hàng duy nhất (O(log N))
cartSchema.index({ userId: 1 }, { unique: true });

// 2. Multikey index: Tìm các giỏ hàng chứa 1 productId (khi đổi giá, xóa sản phẩm, flash sale)
cartSchema.index({ 'items.productId': 1 });

// 3. Multikey index: Tìm theo Cart Item ID bên trong mảng items
cartSchema.index({ 'items._id': 1 });

// 4. Compound index: Tối ưu các thao tác update quantity / xóa item của user (PUT/DELETE /api/carts/:itemId)
cartSchema.index({ userId: 1, 'items._id': 1 });

// 5. Sparse index: Tìm các giỏ hàng đang giữ sản phẩm của 1 Shop (khi Shop tạm đóng hoặc thống kê)
cartSchema.index({ 'items.shopId': 1 }, { sparse: true });

// 6. Single index: Phục vụ quét giỏ hàng bị bỏ quên (Abandoned Cart Recovery) & sắp xếp giỏ hàng mới nhất
cartSchema.index({ updatedAt: -1 });

module.exports = model('Cart', cartSchema);
