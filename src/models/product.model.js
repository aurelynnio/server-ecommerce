const { Schema, model, Types } = require("mongoose");
const slugify = require("slugify");

// Price Schema (simplified for embedding)
const priceSchema = new Schema(
  {
    currentPrice: { type: Number, required: true },
    discountPrice: { type: Number, default: null },
    currency: { type: String, default: "VND" },
  },
  { _id: false }
);

// Tier Variation Definition (e.g., Color bucket)
// Example: { name: "Color", options: ["Red", "Blue"], images: ["url1", "url2"] }
const tierVariationSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g. "Color", "Size"
    options: { type: [String], required: true },
    images: { type: [String], default: [] }, // Optional images for each option (e.g. color swatches)
  },
  { _id: false }
);

// Specific SKU/Model variation
const variationModelSchema = new Schema(
  {
    sku: { type: String, sparse: true },
    // stored as indices into tierVariation options. e.g. [0, 1] means Color[0], Size[1]
    tierIndex: { type: [Number], required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0 },
    sold: { type: Number, default: 0 },
  },
  { _id: true }
); // Keep _id for cart referencing

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String, required: true },

    // Core Relations
    shop: { type: Types.ObjectId, ref: "Shop", required: true },
    category: { type: Types.ObjectId, ref: "Category" },
    shopCategory: { type: Types.ObjectId, ref: "ShopCategory" }, // Internal shop category

    // Metadata
    brand: { type: String },
    tags: { type: [String], default: [] },
    images: { type: [String], default: [] },
    video: { type: String },

    // Pricing & Inventory (Default/Base)
    price: priceSchema, // Base price for display
    stock: { type: Number, default: 0 }, // Total aggregate stock
    soldCount: { type: Number, default: 0 },

    // Advanced Variations (Taobao Style)
    tierVariations: [tierVariationSchema],
    models: [variationModelSchema], // Actual SKUs

    // Shipping
    shippingTemplate: { type: Types.ObjectId, ref: "ShippingTemplate" },
    weight: { type: Number, default: 0 }, // in grams
    dimensions: {
      height: Number,
      width: Number,
      length: Number,
    },

    // Attributes (Filtering)
    attributes: [
      {
        name: String, // e.g. "Material"
        value: String, // e.g. "Cotton"
      },
    ],

    reviews: [{ type: Types.ObjectId, ref: "Review" }],
    ratingAverage: { type: Number, default: 4.5, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["draft", "published", "suspended"],
      default: "published",
    },
  },
  { timestamps: true, collection: "products" }
);

// Indexes
productSchema.index({ slug: 1 });
productSchema.index({ shop: 1 }); // Important for shop pages
productSchema.index({ category: 1 });
productSchema.index({ "price.currentPrice": 1 });
productSchema.index({ soldCount: -1 });
productSchema.index(
  { name: "text", description: "text", brand: "text" },
  { weights: { name: 10, brand: 5, description: 1 } }
);

// Slug generation hook
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
