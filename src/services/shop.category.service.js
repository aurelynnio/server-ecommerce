const ShopCategory = require("../models/shop.category.model");
const Shop = require("../models/shop.model");

class ShopCategoryService {
  async createCategory(userId, categoryData) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("Shop not found");

    const newCategory = await ShopCategory.create({
      ...categoryData,
      shopId: shop._id,
    });

    return newCategory;
  }

  async getMyShopCategories(userId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("Shop not found");

    const categories = await ShopCategory.find({ shopId: shop._id, isActive: true }).sort(
      { displayOrder: 1 }
    );

    return categories;
  }

  async getShopCategories(userId, shopIdParam) {
    let shopId = shopIdParam;

    // If no param, try getting from logged in user (Owner viewing their own)
    if (!shopId && userId) {
      const shop = await Shop.findOne({ owner: userId });
      if (shop) shopId = shop._id;
    }

    if (!shopId) throw new Error("Shop ID required");

    const categories = await ShopCategory.find({ shopId, isActive: true }).sort(
      { displayOrder: 1 }
    );

    return categories;
  }

  async updateCategory(userId, categoryId, updates) {
    const shop = await Shop.findOne({ owner: userId });

    if (!shop) throw new Error("Shop not found");

    const updated = await ShopCategory.findOneAndUpdate(
      { _id: categoryId, shopId: shop._id },
      updates,
      { new: true }
    );
    if (!updated) throw new Error("Category not found");

    return updated;
  }

  async deleteCategory(userId, categoryId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new Error("Shop not found");

    const deleted = await ShopCategory.findOneAndDelete({
      _id: categoryId,
      shopId: shop._id,
    });
    if (!deleted) throw new Error("Category not found");

    return deleted;
  }
}

module.exports = new ShopCategoryService();
