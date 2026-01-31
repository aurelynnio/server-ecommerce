const ShopCategory = require("../models/shop.category.model");
const Shop = require("../models/shop.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

class ShopCategoryService {
  async createCategory(userId, categoryData) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");


    // Seller sees ALL categories (including inactive) for management
    const categories = await ShopCategory.find({ shopId: shop._id }).sort(
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

    if (!shopId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Shop ID required");
    }

    // Convert to ObjectId if string
    const shopObjectId = typeof shopId === "string" 
      ? new mongoose.Types.ObjectId(shopId) 
      : shopId;

    const categories = await ShopCategory.find({ shopId: shopObjectId, isActive: true })
      .sort({ displayOrder: 1 })
      .lean();

    // Get product counts for each category
    const categoryIds = categories.map((c) => c._id);
    const productCounts = await Product.aggregate([
      {
        $match: {
          shop: shopObjectId,
          shopCategory: { $in: categoryIds },
          status: "published",
        },
      },
      {
        $group: {
          _id: "$shopCategory",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create count map
    const countMap = {};
    productCounts.forEach((p) => {
      countMap[p._id.toString()] = p.count;
    });

    // Get total products for this shop
    const totalProducts = await Product.countDocuments({
      shop: shopObjectId,
      status: "published",
    });

    // Add productCount to each category
    const categoriesWithCount = categories.map((cat) => ({
      ...cat,
      productCount: countMap[cat._id.toString()] || 0,
    }));

    return {
      categories: categoriesWithCount,
      totalProducts,
    };
  }

  async updateCategory(userId, categoryId, updates) {
    const shop = await Shop.findOne({ owner: userId });

    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");


    const updated = await ShopCategory.findOneAndUpdate(
      { _id: categoryId, shopId: shop._id },
      updates,
      { new: true }
    );
    if (!updated) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    return updated;
  }

  async deleteCategory(userId, categoryId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");


    const deleted = await ShopCategory.findOneAndDelete({
      _id: categoryId,
      shopId: shop._id,
    });
    if (!deleted) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    return deleted;
  }
}

module.exports = new ShopCategoryService();
