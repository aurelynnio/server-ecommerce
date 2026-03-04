const Review = require('../models/review.model');
const BaseRepository = require('./base.repository');

class ReviewRepository extends BaseRepository {
  constructor() {
    super(Review);
  }

  aggregateShopRatingsByProductIds(productIds) {
    return this.aggregateByPipeline([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]);
  }

  findByUserAndProduct(userId, productId) {
    return this.findOneByFilter({
      user: userId,
      product: productId,
    });
  }

  countByProductWithFilters(productId, { rating } = {}) {
    const query = { product: productId };
    if (rating) {
      query.rating = rating;
    }
    return this.countByFilter(query);
  }

  findByProductWithFilters(
    productId,
    { rating, sort = { createdAt: -1 }, skip = 0, limit = 10 } = {},
  ) {
    const query = { product: productId };
    if (rating) {
      query.rating = rating;
    }

    return this.findManyByFilter(query)
      .populate('user', 'username email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  aggregateRatingDistributionByProduct(productId) {
    return this.aggregateByPipeline([
      { $match: { product: productId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);
  }

  countWithFilters({ rating, search } = {}) {
    const query = {};
    if (rating) {
      query.rating = rating;
    }
    if (search) {
      query.comment = { $regex: search, $options: 'i' };
    }
    return this.countByFilter(query);
  }

  findWithFilters(
    { rating, search } = {},
    { sort = { createdAt: -1 }, skip = 0, limit = 10 } = {},
  ) {
    const query = {};
    if (rating) {
      query.rating = rating;
    }
    if (search) {
      query.comment = { $regex: search, $options: 'i' };
    }

    return this.findManyByFilter(query)
      .populate('user', 'username email avatar')
      .populate('product', 'name slug images')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  countByUserId(userId) {
    return this.countByFilter({ user: userId });
  }

  findByUserIdWithPagination(userId, { skip = 0, limit = 10 } = {}) {
    return this.findManyByFilter({ user: userId })
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  findByIdWithUserAndProduct(reviewId) {
    return this.findById(reviewId)
      .populate('user', 'username email')
      .populate('product', 'name slug images');
  }

  findByIdWithProduct(reviewId) {
    return this.findById(reviewId).populate('product');
  }

  aggregateProductRatingStats(productId) {
    return this.aggregateByPipeline([
      { $match: { product: productId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);
  }

  countByProductIdsWithFilters(productIds, { rating, replyStatus, search } = {}) {
    const query = { product: { $in: productIds } };
    if (rating) {
      query.rating = rating;
    }
    if (replyStatus === 'replied') {
      query.reply = { $ne: '' };
    } else if (replyStatus === 'unreplied') {
      query.reply = '';
    }
    if (search) {
      query.comment = { $regex: search, $options: 'i' };
    }

    return this.countByFilter(query);
  }

  findByProductIdsWithFilters(
    productIds,
    { rating, replyStatus, search } = {},
    { skip = 0, limit = 10 } = {},
  ) {
    const query = { product: { $in: productIds } };
    if (rating) {
      query.rating = rating;
    }
    if (replyStatus === 'replied') {
      query.reply = { $ne: '' };
    } else if (replyStatus === 'unreplied') {
      query.reply = '';
    }
    if (search) {
      query.comment = { $regex: search, $options: 'i' };
    }

    return this.findManyByFilter(query)
      .populate('user', 'username email avatar')
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  aggregateOverallRatingDistribution() {
    return this.aggregateByPipeline([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);
  }

  aggregateOverallAverageRating() {
    return this.aggregateByPipeline([
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
        },
      },
    ]);
  }

  countAll() {
    return this.countByFilter();
  }
}

module.exports = new ReviewRepository();
