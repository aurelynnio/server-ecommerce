const { Schema, model, Types } = require("mongoose");

const addressSchema = new Schema({
  fullName: { type: String, required: true },
  phone: {
    type: String,
    unique: true,
    sparse: true,
  },
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
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isVerifiedEmail: 1 });

module.exports = model("User", userSchema);
