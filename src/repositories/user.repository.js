const User = require('../models/user.model');
const BaseRepository = require('./base.repository');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  buildFilter({ search = '', role, isVerifiedEmail } = {}) {
    const filter = {};
    const normalizedSearch = String(search || '').trim();

    if (normalizedSearch) {
      const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { username: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
      ];
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
    return this.updateById(userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
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
      .sort({ createdAt: -1 });
  }

  aggregateStatisticsWithFilters({ search = '', role, isVerifiedEmail } = {}) {
    const filter = this.buildFilter({ search, role, isVerifiedEmail });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.aggregateByPipeline([
      { $match: filter },
      {
        $facet: {
          totalUsers: [{ $count: 'count' }],
          verifiedUsers: [{ $match: { isVerifiedEmail: true } }, { $count: 'count' }],
          usersWithAddress: [
            {
              $match: {
                'addresses.0': { $exists: true },
              },
            },
            { $count: 'count' },
          ],
          recentUsers: [
            {
              $match: {
                createdAt: { $gte: sevenDaysAgo },
              },
            },
            { $count: 'count' },
          ],
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
