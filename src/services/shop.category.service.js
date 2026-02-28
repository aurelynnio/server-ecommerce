const ShopCategory = require("../repositories/shop-category.repository");
const Shop = require("../repositories/shop.repository");
const Product = require("../repositories/product.repository");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

class ShopCategoryService {
  /**
   * Create category
   * @param {string} userId
   * @param {any} categoryData
   * @returns {Promise<any>}
   */
  async createCategory(userId, categoryData) {
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");

    const existing = await ShopCategory.findByShopAndName(shop._id, categoryData?.name);
    if (existing) {
      throw new ApiError(StatusCodes.CONFLICT, "Category name already exists");
    }

    const created = await ShopCategory.create({
      shopId: shop._id,
      name: categoryData.name,
      description: categoryData?.description || "",
      image: categoryData?.image || "",
      isActive:
        typeof categoryData.isActive === "boolean"
          ? categoryData.isActive
          : true,
      displayOrder:
        typeof categoryData.displayOrder === "number"
          ? categoryData.displayOrder
          : 0,
    });

    return created;
  }

  /**
   * Get categories for current seller's shop (include inactive)
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getMyShopCategories(userId) {
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");

    const categories = await ShopCategory.findByShopIdSorted(shop._id);

    const categoryIds = categories.map((c) => c._id);
    const productCounts = await Product.aggregatePublishedCountsByShopCategories(
      shop._id,
      categoryIds,
    );

    const countMap = {};
    productCounts.forEach((p) => {
      countMap[p._id.toString()] = p.count;
    });

    const totalProducts = await Product.countPublishedByShop(shop._id);

    const categoriesWithCount = categories.map((cat) => ({
      ...cat,
      productCount: countMap[cat._id.toString()] || 0,
    }));

    return {
      categories: categoriesWithCount,
      totalProducts,
    };
  }

  /**
   * Get shop categories
   * @param {string} userId
   * @param {any} shopIdParam
   * @returns {Promise<any>}
   */
  async getShopCategories(userId, shopIdParam) {
    let shopId = shopIdParam;

    // If no param, try getting from logged in user (Owner viewing their own)
    if (!shopId && userId) {
      const shop = await Shop.findByOwnerId(userId);
      if (shop) shopId = shop._id;
    }

    if (!shopId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Shop ID required");
    }

    // Convert to ObjectId if string
    const shopObjectId = typeof shopId === "string" 
      ? new mongoose.Types.ObjectId(shopId) 
      : shopId;

    const categories = await ShopCategory.findActiveByShopIdSorted(shopObjectId);

    // Get product counts for each category
    const categoryIds = categories.map((c) => c._id);
    const productCounts = await Product.aggregatePublishedCountsByShopCategories(
      shopObjectId,
      categoryIds,
    );

    // Create count map
    const countMap = {};
    productCounts.forEach((p) => {
      countMap[p._id.toString()] = p.count;
    });

    // Get total products for this shop
    const totalProducts = await Product.countPublishedByShop(shopObjectId);

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

  /**
   * Update category
   * @param {string} userId
   * @param {string} categoryId
   * @param {Object} updates
   * @returns {Promise<any>}
   */
  async updateCategory(userId, categoryId, updates) {
    const shop = await Shop.findByOwnerId(userId);

    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");

    if (updates?.description === undefined) delete updates.description;
    if (updates?.image === undefined) delete updates.image;

    const updated = await ShopCategory.updateByIdAndShop(categoryId, shop._id, updates);
    if (!updated) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    return updated;
  }

  /**
   * Delete category
   * @param {string} userId
   * @param {string} categoryId
   * @returns {Promise<any>}
   */
  async deleteCategory(userId, categoryId) {
    const shop = await Shop.findByOwnerId(userId);
    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");


    const deleted = await ShopCategory.deleteByIdAndShop(categoryId, shop._id);
    if (!deleted) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    return deleted;
  }
}

module.exports = new ShopCategoryService();


