const ShopFollower = require('../models/shop-follower.model');
const BaseRepository = require('./base.repository');

class ShopFollowerRepository extends BaseRepository {
  constructor() {
    super(ShopFollower);
  }

  findByShopAndUser(shopId, userId) {
    return this.findOneByFilter({ shopId, userId });
  }

  countByShopId(shopId) {
    return this.countByFilter({ shopId });
  }

  deleteByShopAndUser(shopId, userId) {
    return this.deleteOneByFilter({ shopId, userId });
  }

  findByUserSelectShopIds(userId) {
    return this.findManyByFilter({ userId }).select('shopId').lean();
  }
}

module.exports = new ShopFollowerRepository();
