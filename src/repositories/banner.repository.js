const Banner = require('../models/banner.model');
const BaseRepository = require('./base.repository');
const { createLiteralRegex } = require('../utils/query.utils');

class BannerRepository extends BaseRepository {
  constructor() {
    super(Banner);
  }

  updateById(id, payload) {
    return super.updateById(id, payload, { new: true });
  }

  _buildFilterQuery({ search, ...otherFilters } = {}) {
    const query = { ...otherFilters };
    const searchRegex = createLiteralRegex(search);

    if (searchRegex) {
      query.$or = [{ title: searchRegex }, { subtitle: searchRegex }];
    }

    return query;
  }

  countByFilters(filter = {}) {
    const query = this._buildFilterQuery(filter);
    return this.countByFilter(query);
  }

  findByFilters(filter = {}, { skip, limit } = {}) {
    const query = this._buildFilterQuery(filter);
    return this.findManyByFilter(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
}

module.exports = new BannerRepository();
