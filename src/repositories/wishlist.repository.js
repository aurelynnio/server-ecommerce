const Wishlist = require('../models/wishlist.model');
const BaseRepository = require('./base.repository');

class WishlistRepository extends BaseRepository {
  constructor() {
    super(Wishlist);
  }

  countByUserId(userId) {
    return this.countDocuments({ userId });
  }

  findProductIdsByUserId(userId, { skip, limit }) {
    return this.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('productId')
      .lean();
  }

  findByUserIdAndProductId(userId, productId) {
    return this.findOne({ userId, productId });
  }

  deleteByUserIdAndProductId(userId, productId) {
    return this.deleteOne({ userId, productId });
  }

  deleteManyByUserId(userId) {
    return this.deleteMany({ userId });
  }

  findByUserIdAndProductIds(userId, productIds) {
    return this.find({
      userId,
      productId: { $in: productIds },
    })
      .select('productId')
      .lean();
  }

  findProductIdsByUserIdAll(userId) {
    return this.findManyByFilter({ userId }).select('productId').lean();
  }
}

module.exports = new WishlistRepository();
