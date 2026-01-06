const { Schema, model, Types } = require("mongoose");

const shopSchema = new Schema(
  {
    owner: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // 1 User = 1 Shop for now
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 150,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    logo: { type: String, default: "" },
    banner: { type: String, default: "" },
    description: { type: String, default: "" },

    // Address for returns/pickup
    pickupAddress: {
      fullName: { type: String },
      phone: { type: String },
      address: { type: String },
      city: { type: String },
      district: { type: String },
      ward: { type: String },
    },

    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
    },

    // Reputation Metrics
    rating: {
      type: Number,
      default: 4.5,
      min: 1,
      max: 5,
    },
    metrics: {
      responseRate: { type: Number, default: 100 }, // %
      shippingOnTime: { type: Number, default: 100 }, // %
      ratingCount: { type: Number, default: 0 },
    },

    followers: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "shops",
  }
);

// Indexes
shopSchema.index({ name: "text" });
shopSchema.index({ owner: 1 });

module.exports = model("Shop", shopSchema);
