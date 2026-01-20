const { Schema, model } = require("mongoose");

/**
 * Settings Model
 * Stores system-wide configuration settings for the admin panel
 */
const settingsSchema = new Schema(
  {
    // Use a fixed key to ensure only one settings document exists
    key: {
      type: String,
      default: "main",
      unique: true,
    },

    // Store settings section
    store: {
      name: { type: String, default: "My E-commerce Store" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      description: { type: String, default: "" },
      logo: { type: String, default: "" },
      favicon: { type: String, default: "" },
    },

    // Notification settings
    notifications: {
      newOrders: { type: Boolean, default: true },
      lowStock: { type: Boolean, default: true },
      newUsers: { type: Boolean, default: false },
      newReviews: { type: Boolean, default: true },
      orderStatusUpdates: { type: Boolean, default: true },
    },

    // Display/appearance settings
    display: {
      darkMode: { type: Boolean, default: false },
      language: { type: String, default: "vi" },
      currency: { type: String, default: "VND" },
      dateFormat: { type: String, default: "DD/MM/YYYY" },
      itemsPerPage: { type: Number, default: 20 },
    },

    // Business settings
    business: {
      lowStockThreshold: { type: Number, default: 10 },
      orderPrefix: { type: String, default: "ORD" },
      enableReviews: { type: Boolean, default: true },
      enableWishlist: { type: Boolean, default: true },
      enableChat: { type: Boolean, default: true },
    },

    // Last updated by
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true, collection: "settings" },
);

module.exports = model("Settings", settingsSchema);
