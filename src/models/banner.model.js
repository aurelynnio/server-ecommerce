const { Schema, model } = require('mongoose');

const bannerSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    link: { type: String, default: '' }, // Optional link to navigate to
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    order: { type: Number, default: 0 }, // For sorting
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'banners',
  },
);

// Indexes
bannerSchema.index({ isActive: 1 });
bannerSchema.index({ order: 1 });

module.exports = model('Banner', bannerSchema);
