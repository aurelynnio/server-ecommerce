const { Schema, model, Types } = require("mongoose");

const orderSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    products: [
      {
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
        name: { type: String, required: true },
        sku: { type: String },
        color: { type: String },
        size: { type: String },
        image: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price: {
          currentPrice: { type: Number, required: true },
          discountPrice: { type: Number, default: null },
          currency: { type: String, default: "VND" },
        },
      },
    ],

    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      district: { type: String },
      ward: { type: String },
      note: { type: String },
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "vnpay"],
      default: "cod",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },

    subtotal: { type: Number, required: true, min: 0 },
    discountCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: [
        "pending", // chờ xác nhận
        "confirmed", // đã xác nhận
        "processing", // đang xử lý
        "shipped", // đã gửi hàng
        "delivered", // giao thành công
        "cancelled", // đã hủy
      ],
      default: "pending",
    },

    deliveredAt: { type: Date },
  },
  { timestamps: true, collection: "orders" }
);

module.exports = model("Order", orderSchema);
