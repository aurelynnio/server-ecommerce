const { Schema, model, Types } = require('mongoose');

const voucherSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true }, // e.g. "Summer Sale"
    description: { type: String },

    type: {
      type: String,
      enum: ['fixed_amount', 'percentage'],
      required: true,
    },
    value: { type: Number, required: true }, // 10000 or 10 (%)
    maxValue: { type: Number }, // Max discount for percentage

    // Scope: Shop or Platform
    scope: {
      type: String,
      enum: ['shop', 'platform'],
      default: 'shop',
    },
    shopId: { type: Types.ObjectId, ref: 'Shop' }, // Required if scope is "shop"

    minOrderValue: { type: Number, default: 0 },

    usageLimit: { type: Number, default: 1000 },
    usageCount: { type: Number, default: 0 },
    usageLimitPerUser: { type: Number, default: 1 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isActive: { type: Boolean, default: true },

    // Usage tracking is now in VoucherUsage collection
  },
  {
    timestamps: true,
    collection: 'vouchers',
  },
);

voucherSchema.index({ shopId: 1 });
voucherSchema.index({ startDate: 1, endDate: 1 });

module.exports = model('Voucher', voucherSchema);
