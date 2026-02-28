const ShopCategory = require("../models/shop.category.model");
const BaseRepository = require("./base.repository");

class ShopCategoryRepository extends BaseRepository {
  constructor() {
    super(ShopCategory);
  }

  findByShopIdSorted(shopId) {
    return this.findManyByFilter({ shopId })
      .sort({ displayOrder: 1 })
      .lean();
  }

  findActiveByShopIdSorted(shopId) {
    return this.findManyByFilter({ shopId, isActive: true })
      .sort({ displayOrder: 1 })
      .lean();
  }

  findByShopAndName(shopId, name) {
    return this.findOneByFilter({ shopId, name });
  }

  updateByIdAndShop(categoryId, shopId, updates) {
    return this.findOneAndUpdateByFilter(
      { _id: categoryId, shopId },
      updates,
      { new: true },
    );
  }

  deleteByIdAndShop(categoryId, shopId) {
    return this.findOneAndDeleteByFilter({
      _id: categoryId,
      shopId,
    });
  }
}

module.exports = new ShopCategoryRepository();
