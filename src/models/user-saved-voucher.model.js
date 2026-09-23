const { Schema, model, Types } = require('mongoose');

const userSavedVoucherSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    voucherId: { type: Types.ObjectId, ref: 'Voucher', required: true },
  },
  {
    timestamps: true,
    collection: 'user_saved_vouchers',
  },
);

// Compound unique: 1 user chỉ lưu 1 voucher 1 lần
userSavedVoucherSchema.index({ userId: 1, voucherId: 1 }, { unique: true });
// Query: lấy danh sách voucher đã lưu của user theo thứ tự mới nhất
userSavedVoucherSchema.index({ userId: 1, createdAt: -1 });
// Query: đếm số lượng người đã lưu voucher này
userSavedVoucherSchema.index({ voucherId: 1 });

module.exports = model('UserSavedVoucher', userSavedVoucherSchema);

