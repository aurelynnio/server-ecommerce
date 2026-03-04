const { Schema, model, Types } = require('mongoose');

const orderSchema = new Schema(
  {
    // Grouping for finding all orders in one checkout transaction
    orderGroupId: { type: Types.ObjectId },

    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Critical for Multi-Vendor: Which shop does this order belong to?
    shopId: {
      type: Types.ObjectId,
      ref: 'Shop',
      required: true,
    },

    products: [
      {
        productId: {
          type: Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        // Variant identification
        sku: { type: String }, // specific sku code
        variantId: { type: Types.ObjectId }, // maps to product.variants._id (color variant)

        name: { type: String, required: true },
        image: { type: String },

        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true }, // Snapshot price at purchase
        totalPrice: { type: Number, required: true }, // quantity * price
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
      enum: ['cod', 'vnpay', 'momo'],
      default: 'cod',
    },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },

    // Financials
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0 }, // Calculated via ShippingTemplate
    discountShop: { type: Number, default: 0 }, // Shop voucher
    discountPlatform: { type: Number, default: 0 }, // Platform voucher
    totalAmount: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing', // Shop packing
        'shipped', // Handed to carrier
        'delivered',
        'cancelled',
        'returned',
      ],
      default: 'pending',
    },

    // Tracking
    trackingNumber: { type: String },
    carrier: { type: String },

    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true, collection: 'orders' },
);

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 }); // User order history
orderSchema.index({ userId: 1, status: 1 }); // User filtering by status
orderSchema.index({ shopId: 1, status: 1 }); // Seller dashboard filtering
orderSchema.index({ shopId: 1, createdAt: -1 }); // Seller order history
orderSchema.index({ orderGroupId: 1 }); // User finding their "checkout history"
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });

module.exports = model('Order', orderSchema);
