const UserSavedVoucher = require('../models/user-saved-voucher.model');
const BaseRepository = require('./base.repository');

class UserSavedVoucherRepository extends BaseRepository {
  constructor() {
    super(UserSavedVoucher);
  }

  findByUserAndVoucher(userId, voucherId) {
    return this.findOneByFilter({ userId, voucherId });
  }

  saveVoucher(userId, voucherId) {
    return this.findOneAndUpdateByFilter(
      { userId, voucherId },
      { userId, voucherId },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  unsaveVoucher(userId, voucherId) {
    return this.deleteOneByFilter({ userId, voucherId });
  }

  countByUserId(userId) {
    return this.countByFilter({ userId });
  }

  async findSavedVoucherIdsByUserId(userId, limit = 500) {
    const list = await this.findManyByFilter({ userId })
      .select('voucherId -_id')
      .limit(limit)
      .lean();
    return list
      .filter((item) => item && item.voucherId)
      .map((item) => item.voucherId.toString());
  }

  findSavedVouchersByUserId(userId, limit = 100) {
    return this.findManyByFilter({ userId })
      .populate({
        path: 'voucherId',
        populate: {
          path: 'shopId',
          select: 'name logo slug',
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new UserSavedVoucherRepository();

