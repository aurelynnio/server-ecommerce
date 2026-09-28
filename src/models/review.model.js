const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    reply: { type: String, default: '' },
    replyAt: { type: Date },
  },
  { timestamps: true, collection: 'reviews' },
);

// Indexes
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ product: 1, rating: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 }); // Danh sách review admin (sort mặc định theo createdAt)
reviewSchema.index({ rating: 1, createdAt: -1 }); // Lọc review theo rating + sort createdAt

module.exports = model('Review', reviewSchema);
