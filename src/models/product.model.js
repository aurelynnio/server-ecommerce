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
    tierIndex: { type: [Number], required: true }, // e.g. [0, 1] means Color[0], Size[1]
    price: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0 },
    sold: { type: Number, default: 0 },
  },
  { _id: true }
);

// Product Attribute for specifications
const attributeSchema = new Schema(
  {
    name: { type: String, required: true },  // e.g. "Material", "Weight"
    value: { type: String, required: true }, // e.g. "Cotton", "500g"
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 10000 },

    // Core Relations
    shop: { type: Types.ObjectId, ref: "Shop", required: true, index: true },
    category: { type: Types.ObjectId, ref: "Category", index: true },
    shopCategory: { type: Types.ObjectId, ref: "ShopCategory" },

    // Metadata
    brand: { type: String, maxlength: 100 },
    tags: { type: [String], default: [], index: true },
    
    // Media - Limit array sizes for performance
    images: { 
      type: [String], 
      default: [],
      validate: [arr => arr.length <= 10, 'Maximum 10 images allowed']
    },
    descriptionImages: { 
      type: [String], 
      default: [],
      validate: [arr => arr.length <= 20, 'Maximum 20 description images allowed']
    },
    video: { type: String },

    // Pricing & Inventory
    price: priceSchema,
    // Cached aggregates from models[] - updated via hooks/service
    stock: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },

    // Advanced Variations (Taobao Style)
    tierVariations: {
      type: [tierVariationSchema],
      validate: [arr => arr.length <= 3, 'Maximum 3 tier variations allowed']
    },
    models: {
      type: [variationModelSchema],
      validate: [arr => arr.length <= 100, 'Maximum 100 SKU models allowed']
    },

    // Shipping
    shippingTemplate: { type: Types.ObjectId, ref: "ShippingTemplate" },
    weight: { type: Number, default: 0, min: 0 }, // grams
    dimensions: {
      height: { type: Number, min: 0 }, // cm
      width: { type: Number, min: 0 },
      length: { type: Number, min: 0 },
    },

    // Attributes/Specifications
    attributes: {
      type: [attributeSchema],
      validate: [arr => arr.length <= 30, 'Maximum 30 attributes allowed']
    },

    // Reviews - Cached counters (actual reviews in Review collection)
    // DO NOT store review ObjectIds here - query from Review collection instead
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },

    // Flash Sale - Consider separate FlashSale collection if complex campaigns needed
    flashSale: {
      isActive: { type: Boolean, default: false },
      salePrice: { type: Number, min: 0 },
      discountPercent: { type: Number, min: 0, max: 100 },
      stock: { type: Number, min: 0 },
      soldCount: { type: Number, default: 0, min: 0 },
      startTime: { type: Date },
      endTime: { type: Date },
    },

    // Flags for filtering/display
    isFeatured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false },

    // Status - Single source of truth (replaces isActive + onSale)
    status: {
      type: String,
      enum: ["draft", "published", "suspended", "deleted"],
      default: "published",
      index: true,
    },
  },
  { 
    timestamps: true, 
    collection: "products",
    // Optimize for reads
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== VIRTUALS ====================
// Computed fields - not stored, calculated on read

// Check if product is on sale (derived from price or flashSale)
productSchema.virtual("onSale").get(function () {
  if (this.flashSale?.isActive) {
    const now = new Date();
    return this.flashSale.startTime <= now && this.flashSale.endTime > now;
  }
  return this.price?.discountPrice && this.price.discountPrice < this.price.currentPrice;
});

// Check if product is active (derived from status)
productSchema.virtual("isActive").get(function () {
  return this.status === "published";
});

// Get effective price (considering flash sale)
productSchema.virtual("effectivePrice").get(function () {
  if (this.flashSale?.isActive) {
    const now = new Date();
    if (this.flashSale.startTime <= now && this.flashSale.endTime > now) {
      return this.flashSale.salePrice;
    }
  }
  return this.price?.discountPrice || this.price?.currentPrice;
});

// ==================== INDEXES ====================
// Compound indexes for common queries
productSchema.index({ shop: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, isFeatured: -1, createdAt: -1 });
productSchema.index({ status: 1, soldCount: -1 });
productSchema.index({ status: 1, "price.currentPrice": 1 });
productSchema.index({ "flashSale.isActive": 1, "flashSale.endTime": 1 });

// Text search index
productSchema.index(
  { name: "text", description: "text", brand: "text", tags: "text" },
  { weights: { name: 10, brand: 5, tags: 3, description: 1 } }
);

// ==================== HOOKS ====================
// Slug generation
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

// Ensure unique slug
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

// Sync stock/soldCount from models before save
productSchema.pre("save", function (next) {
  if (this.models && this.models.length > 0) {
    this.stock = this.models.reduce((sum, m) => sum + (m.stock || 0), 0);
    this.soldCount = this.models.reduce((sum, m) => sum + (m.sold || 0), 0);
  }
  next();
});

// ==================== STATIC METHODS ====================
// Efficient queries for common use cases

productSchema.statics.findPublished = function (filter = {}) {
  return this.find({ ...filter, status: "published" });
};

productSchema.statics.findByShop = function (shopId, options = {}) {
  const { status = "published", page = 1, limit = 20 } = options;
  return this.find({ shop: shopId, status })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

productSchema.statics.findFlashSale = function (limit = 20) {
  const now = new Date();
  return this.find({
    status: "published",
    "flashSale.isActive": true,
    "flashSale.startTime": { $lte: now },
    "flashSale.endTime": { $gt: now },
  })
    .limit(limit)
    .lean();
};

// Update review stats (call from Review service after review CRUD)
productSchema.statics.updateReviewStats = async function (productId) {
  const Review = require("./review.model");
  const stats = await Review.aggregate([
    { $match: { product: new Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const { avgRating = 0, count = 0 } = stats[0] || {};
  return this.findByIdAndUpdate(productId, {
    ratingAverage: Math.round(avgRating * 10) / 10,
    reviewCount: count,
  });
};

module.exports = model("Product", productSchema);
