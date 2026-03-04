const { Schema, model, Types } = require('mongoose');

const paymentSchema = new Schema(
  {
    orderId: {
      type: Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'vnpay', 'momo'],
      default: 'cod',
    },
    // Payment gateway specific fields
    transactionId: {
      type: String,
      unique: true,
      sparse: true, // Allow null for COD payments
    },
    paymentUrl: {
      type: String,
      default: null,
    },
    gatewayData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'payments',
  },
);

// Index for quick lookup by transaction ID
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });

module.exports = model('Payment', paymentSchema);
