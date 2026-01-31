const Settings = require("../models/settings.model");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");


class SettingsService {
  /**
   * Get all settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    // Find existing settings or create default
    let settings = await Settings.findOne({ key: "main" });

    if (!settings) {
      settings = await Settings.create({ key: "main" });
    }

    return settings;
  }

  /**
   * Update settings (partial update)
   * @param {Object} updates - Fields to update
   * @param {string} userId - Admin user ID who made the change
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(updates, userId) {
    const { store, notifications, display, business } = updates;

    const updateData = {};

    // Only update fields that are provided
    if (store) {
      Object.keys(store).forEach((key) => {
        updateData[`store.${key}`] = store[key];
      });
    }

    if (notifications) {
      Object.keys(notifications).forEach((key) => {
        updateData[`notifications.${key}`] = notifications[key];
      });
    }

    if (display) {
      Object.keys(display).forEach((key) => {
        updateData[`display.${key}`] = display[key];
      });
    }

    if (business) {
      Object.keys(business).forEach((key) => {
        updateData[`business.${key}`] = business[key];
      });
    }

    updateData.updatedBy = userId;

    const settings = await Settings.findOneAndUpdate(
      { key: "main" },
      { $set: updateData },
      { new: true, upsert: true },
    );

    return settings;
  }

  /**
   * Get a specific settings section
   * @param {string} section - Section name (store, notifications, display, business)
   * @returns {Promise<Object>} Section data
   */
  async getSection(section) {
    const validSections = ["store", "notifications", "display", "business"];
    if (!validSections.includes(section)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid settings section");
    }


    const settings = await this.getSettings();
    return settings[section];
  }

  /**
   * Update a specific section
   * @param {string} section - Section name
   * @param {Object} data - Section data to update
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object>} Updated settings
   */
  async updateSection(section, data, userId) {
    const validSections = ["store", "notifications", "display", "business"];
    if (!validSections.includes(section)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid settings section");
    }


    const updateData = {};
    Object.keys(data).forEach((key) => {
      updateData[`${section}.${key}`] = data[key];
    });
    updateData.updatedBy = userId;

    const settings = await Settings.findOneAndUpdate(
      { key: "main" },
      { $set: updateData },
      { new: true, upsert: true },
    );

    return settings;
  }

  /**
   * Reset settings to default
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object>} Reset settings
   */
  async resetSettings(userId) {
    await Settings.deleteOne({ key: "main" });
    const settings = await Settings.create({
      key: "main",
      updatedBy: userId,
    });
    return settings;
  }
}

module.exports = new SettingsService();
