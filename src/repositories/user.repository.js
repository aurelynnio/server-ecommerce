const User = require('../models/user.model');
const BaseRepository = require('./base.repository');
const { createLiteralRegex } = require('../utils/query.utils');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  buildFilter({ search = '', role, isVerifiedEmail } = {}) {
    const filter = {};
    const searchRegex = createLiteralRegex(search);

    if (searchRegex) {
      filter.$or = [{ username: searchRegex }, { email: searchRegex }];
    }

    if (role && role !== '') {
      filter.roles = role;
    }

    if (isVerifiedEmail !== undefined && isVerifiedEmail !== '') {
      filter.isVerifiedEmail = isVerifiedEmail;
    }

    return filter;
  }

  findByEmail(email) {
    return this.findOneByFilter({ email });
  }

  findByUsername(username) {
    return this.findOneByFilter({ username });
  }

  findByVerificationEmailCode(code) {
    return this.findOneByFilter({ codeVerifiEmail: code });
  }

  findByIdWithRefreshFields(userId) {
    return this.findById(userId).select('+refreshTokenHash +refreshTokenExpiresAt');
  }

  clearRefreshToken(userId) {
    return this.updateOneByFilter(
      { _id: userId },
      {
        $set: {
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
      },
    );
  }

  streamAllUserIds() {
    return this.findManyByFilter({}).select('_id').cursor();
  }

  countUsersByRole() {
    return this.countByFilter({ roles: 'user' });
  }

  findByOwnerShop(shopId) {
    return this.findOneByFilter({ shop: shopId });
  }

  findByIdWithoutPassword(userId) {
    return this.findById(userId).select('-password');
  }

  findByIdWithAddresses(userId) {
    return this.findById(userId).select('addresses');
  }

  findByUsernameExcludingId(username, userId) {
    return this.findOneByFilter({
      username,
      _id: { $ne: userId },
    });
  }

  findByEmailExcludingId(email, userId) {
    return this.findOneByFilter({
      email,
      _id: { $ne: userId },
    });
  }

  countWithFilters({ search = '', role, isVerifiedEmail } = {}) {
    return this.countByFilter(this.buildFilter({ search, role, isVerifiedEmail }));
  }

  findWithFilters({ search = '', role, isVerifiedEmail } = {}, { skip = 0, limit = 10 } = {}) {
    const filter = this.buildFilter({ search, role, isVerifiedEmail });

    return this.findManyByFilter(filter)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();
  }

  aggregateStatisticsWithFilters({ search = '', role, isVerifiedEmail } = {}) {
    const filter = this.buildFilter({ search, role, isVerifiedEmail });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.aggregateByPipeline([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalUsersCount: { $sum: 1 },
          verifiedUsersCount: {
            $sum: { $cond: [{ $eq: ['$isVerifiedEmail', true] }, 1, 0] },
          },
          usersWithAddressCount: {
            $sum: {
              $cond: [{ $gt: [{ $size: { $ifNull: ['$addresses', []] } }, 0] }, 1, 0],
            },
          },
          recentUsersCount: {
            $sum: { $cond: [{ $gte: ['$createdAt', sevenDaysAgo] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalUsers: [{ count: '$totalUsersCount' }],
          verifiedUsers: {
            $cond: ['$verifiedUsersCount', [{ count: '$verifiedUsersCount' }], []],
          },
          usersWithAddress: {
            $cond: ['$usersWithAddressCount', [{ count: '$usersWithAddressCount' }], []],
          },
          recentUsers: {
            $cond: ['$recentUsersCount', [{ count: '$recentUsersCount' }], []],
          },
        },
      },
    ]);
  }

  countCreatedBetween(startDate, endDate) {
    return this.countByFilter({
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    });
  }
}

module.exports = new UserRepository();
