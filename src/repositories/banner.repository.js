const Banner = require('../models/banner.model');
const { createLiteralRegex } = require('../utils/query.utils');

class BannerRepository {
  create(payload) {
    return Banner.create(payload);
  }

  countByQuery(query) {
    return Banner.countDocuments(query);
  }

  findWithPagination(query, { skip, limit }) {
    return Banner.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  findById(id) {
    return Banner.findById(id);
  }

  updateById(id, payload) {
    return Banner.findByIdAndUpdate(id, payload, { new: true });
  }

  deleteById(id) {
    return Banner.findByIdAndDelete(id);
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
    return Banner.countDocuments(query);
  }

  findByFilters(filter = {}, { skip, limit }) {
    const query = this._buildFilterQuery(filter);

    return Banner.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).lean();
  }
}

module.exports = new BannerRepository();
