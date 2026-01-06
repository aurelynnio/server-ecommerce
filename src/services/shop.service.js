const Shop = require("../models/shop.model");
const User = require("../models/user.model");

const slugify = require("slugify");

class ShopService {
  async createShop(userId, shopData) {
    const { name, ...otherDetails } = shopData;

    // Check if user already has a shop
    const existingShop = await Shop.findOne({ owner: userId });
    if (existingShop) {
      throw new Error("User already owns a shop");
    }

    // Check duplicate name
    const existingName = await Shop.findOne({ name });
    if (existingName) {
      throw new Error("Shop name already taken");
    }

    const slug = slugify(name, { lower: true });

    const newShop = await Shop.create({
      owner: userId,
      name,
      slug,
      ...otherDetails,
    });

    // Update User Role to Seller
    await User.findByIdAndUpdate(userId, {
      $addToSet: { roles: "seller" },
      shop: newShop._id,
    });

    return newShop;
  }

  async getShopInfo(shopId) {
    const findShop = await Shop.findById(shopId).lean();
    if (!findShop) throw new Error("Shop not found");
    return findShop;
  }

  async getMyShop(userId) {
    const findShop = await Shop.findOne({ owner: userId }).lean();
    if (!findShop) throw new Error("You usually do not have a shop");
    return findShop;
  }

  async updateShop(userId, updates) {
    // Remove sensitive fields
    delete updates.owner;
    delete updates.status;
    delete updates.rating;
    delete updates.metrics;

    const updatedShop = await Shop.findOneAndUpdate(
      { owner: userId },
      updates,
      { new: true }
    );

    if (!updatedShop) throw new Error("Shop not found");
    return updatedShop;
  }
}

module.exports = new ShopService();
