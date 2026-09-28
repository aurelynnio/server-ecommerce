const { Schema, model, Types } = require('mongoose');

const voucherUsageSchema = new Schema(
  {
    voucherId: { type: Types.ObjectId, ref: 'Voucher', required: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Types.ObjectId, ref: 'Order' },
    // Voucher platform dùng chung cho cả order group (1 checkout nhiều shop)
    orderGroupId: { type: Types.ObjectId },
  },
  {
    timestamps: true,
    collection: 'voucher_usages',
  },
);

// Query: lich su voucher cua user
voucherUsageSchema.index({ userId: 1, createdAt: -1 });
// Lưu ý: countByVoucherAndUser + các aggregate theo voucherId được phục vụ bởi
// tiền tố (prefix) của 2 unique sparse index phía dưới, không cần index riêng.
// Exactly-once guarantee: chống double-spend voucher shop theo orderId
voucherUsageSchema.index({ voucherId: 1, userId: 1, orderId: 1 }, { unique: true, sparse: true });
// Exactly-once guarantee: chống double-spend voucher platform theo orderGroupId
voucherUsageSchema.index(
  { voucherId: 1, userId: 1, orderGroupId: 1 },
  { unique: true, sparse: true },
);

module.exports = model('VoucherUsage', voucherUsageSchema);
