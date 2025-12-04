const { Schema, model, Types } = require("mongoose");

const discountSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, 
    description: { type: String },
    discountType: {
      type: String,
      enum: ["percent", "fixed"], 
      required: true,
    },
    discountValue: { type: Number, required: true }, // ví dụ 10% hoặc 50000
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    applicableProducts: [{ type: Types.ObjectId, ref: "Product" }], // có thể rỗng nếu áp dụng toàn shop
    minOrderValue: { type: Number, default: 0 }, // giá trị tối thiểu để dùng
    usageLimit: { type: Number, default: 1 }, // giới hạn lượt dùng
    usedCount: { type: Number, default: 0 }, // đã dùng bao nhiêu lần
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "discounts",
  }
);

// Indexes
discountSchema.index({ code: 1 });
discountSchema.index({ isActive: 1 });
discountSchema.index({ startDate: 1 });
discountSchema.index({ endDate: 1 });
discountSchema.index({ code: 1, isActive: 1 });

module.exports = model("Discount", discountSchema);
