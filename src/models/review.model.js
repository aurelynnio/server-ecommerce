const { Schema, model, Types } = require("mongoose");

const reviewSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    product: { type: Types.ObjectId, ref: "Product", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

// Indexes
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ product: 1, createdAt: -1 }); // Reviews for a product, newest first
reviewSchema.index({ product: 1, rating: -1 }); // Reviews for a product, highest rating first

module.exports = model("Review", reviewSchema);
