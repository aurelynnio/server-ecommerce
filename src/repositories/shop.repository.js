const Shop = require('../models/shop.model');
const BaseRepository = require('./base.repository');
const { createLiteralRegex } = require('../utils/query.utils');

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

  _buildFilterQuery({ status, search } = {}) {
    const query = {};
    if (status) {
      query.status = status;
    }
    const searchRegex = createLiteralRegex(search);
    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    return query;
  }

  countWithFilters(filters = {}) {
    return this.countByFilter(this._buildFilterQuery(filters));
  }

  findWithFilters(filters = {}, { sort = '-createdAt', skip = 0, limit = 10 } = {}) {
    const query = this._buildFilterQuery(filters);

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

  findActiveByNameRegex(search, limit = 5) {
    const searchRegex = createLiteralRegex(search);
    return this.findManyByFilter({
      status: 'active',
      ...(searchRegex && { name: searchRegex }),
    })
      .select('name slug logo')
      .limit(limit)
      .lean();
  }
}

module.exports = new ShopRepository();
