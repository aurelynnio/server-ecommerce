const Shop = require('../models/shop.model');
const BaseRepository = require('./base.repository');

class ShopRepository extends BaseRepository {
  constructor() {
    super(Shop);
  }

  findByOwnerId(ownerId) {
    return this.findOneByFilter({ owner: ownerId });
  }

  findByOwnerIdLean(ownerId) {
    return this.findOneByFilter({ owner: ownerId }).lean();
  }

  findByName(name) {
    return this.findOneByFilter({ name });
  }

  findBySlugActive(slug) {
    return this.findOneByFilter({ slug, status: 'active' })
      .populate('owner', 'username avatar')
      .lean();
  }

  updateByOwnerId(ownerId, updates) {
    return this.findOneAndUpdateByFilter({ owner: ownerId }, updates, { new: true });
  }

  countWithFilters({ status, search } = {}) {
    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    return this.countByFilter(query);
  }

  findWithFilters({ status, search } = {}, { sort = '-createdAt', skip = 0, limit = 10 } = {}) {
    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    return this.findManyByFilter(query)
      .populate('owner', 'username email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  findByIdLean(shopId) {
    return this.findById(shopId).lean();
  }

  findActiveByIds(shopIds) {
    return this.findManyByFilter({
      _id: { $in: shopIds },
      status: 'active',
    })
      .select('name slug logo rating')
      .lean();
  }

  findActiveByNameRegex(regex, limit = 5) {
    return this.findManyByFilter({
      status: 'active',
      name: regex,
    })
      .select('name slug logo')
      .limit(limit)
      .lean();
  }
}

module.exports = new ShopRepository();
