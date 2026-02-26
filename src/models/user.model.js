const { Schema, model } = require("mongoose");

const addressSchema = new Schema({
  fullName: { type: String, required: true },
  phone: { type: String },
  address: String,
  city: String,
  district: String,
  ward: String,
  isDefault: Boolean,
});

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    roles: {
      type: String,
      enum: ["user", "admin", "seller"],
      default: "user",
    },
    shop: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },
    permissions: {
      type: [String],
      default: [],
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    avatar: {
      type: String,
      default: null,
    },
    // Wishlist and followingShops are now in separate collections:
    // - Wishlist model (wishlists collection)
    // - ShopFollower model (shop_followers collection)
    codeVerifiEmail: {
      type: String,
    },
    isVerifiedEmail: {
      type: Boolean,
      default: false,
    },
    expiresCodeVerifiEmail: {
      type: Date,
    },
    codeVerifiPassword: {
      type: String,
    },
    expiresCodeVerifiPassword: {
      type: Date,
    },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// Indexes
userSchema.index({ roles: 1 });
userSchema.index({ isVerifiedEmail: 1 });

module.exports = model("User", userSchema);
