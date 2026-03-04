const { Schema, model, Types } = require('mongoose');

const voucherUsageSchema = new Schema(
  {
    voucherId: { type: Types.ObjectId, ref: 'Voucher', required: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Types.ObjectId, ref: 'Order' },
  },
  {
    timestamps: true,
    collection: 'voucher_usages',
  },
);

// Query: dem so lan user da dung voucher nay
voucherUsageSchema.index({ voucherId: 1, userId: 1 });
// Query: dem tong so luot su dung cua voucher
voucherUsageSchema.index({ voucherId: 1, createdAt: -1 });
// Query: lich su voucher cua user
voucherUsageSchema.index({ userId: 1, createdAt: -1 });

module.exports = model('VoucherUsage', voucherUsageSchema);
