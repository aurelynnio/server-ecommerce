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
// ESR index cho countByVoucherAndUser + aggregateUsageByVoucherIdsAndUser (userId Equality -> voucherId $in)
voucherUsageSchema.index({ userId: 1, voucherId: 1 });
// Exactly-once guarantee: chống double-spend voucher shop theo orderId
voucherUsageSchema.index(
  { voucherId: 1, userId: 1, orderId: 1 },
  { unique: true, partialFilterExpression: { orderId: { $exists: true } } },
);
// Exactly-once guarantee: chống double-spend voucher platform theo orderGroupId
voucherUsageSchema.index(
  { voucherId: 1, userId: 1, orderGroupId: 1 },
  { unique: true, partialFilterExpression: { orderGroupId: { $exists: true } } },
);

module.exports = model('VoucherUsage', voucherUsageSchema);
