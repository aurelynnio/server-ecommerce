const { Schema, model, Types } = require("mongoose");
const slugify = require("slugify");

const priceSchema = new Schema(
  {
    currentPrice: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    currency: { type: String, required: true, default: "VND" },
  },
  { _id: false }
);

const variantSchema = new Schema({
  sku: { type: String, required: true, unique: true, sparse: true },
  color: { type: String },
  size: { type: String },
  stock: { type: Number, default: 0 },
  images: { type: [String], default: [] },
  price: priceSchema,
});

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    slug: { type: String, unique: true, lowercase: true },
    category: { type: Types.ObjectId, ref: "Category" },
    brand: { type: String },
    price: priceSchema,
    variants: [variantSchema],
    reviews: [{ type: Types.ObjectId, ref: "Review" }],
    tags: { type: [String], default: [] },
    soldCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isNewArrival: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    onSale: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "products" }
);

// Indexes
productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ "price.currentPrice": 1 });
productSchema.index({ soldCount: -1 });
productSchema.index(
  { name: "text", description: "text", brand: "text" },
  {
    weights: {
      name: 10,
      brand: 5,
      description: 1,
    },
    name: "TextIndex",
  }
);
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 });

// Auto-generate slug from name before validation
productSchema.pre("validate", function (next) {
  if (this.name && !this.slug) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      locale: "vi",
    });
  }
  next();
});

// Handle slug conflicts by adding a random suffix
productSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("slug")) {
    const existingProduct = await this.constructor.findOne({
      slug: this.slug,
      _id: { $ne: this._id },
    });

    if (existingProduct) {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      this.slug = `${this.slug}-${randomSuffix}`;
    }
  }
  next();
});

module.exports = model("Product", productSchema);
