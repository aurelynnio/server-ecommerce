const UserSavedVoucher = require('../models/user-saved-voucher.model');
const BaseRepository = require('./base.repository');

class UserSavedVoucherRepository extends BaseRepository {
  constructor() {
    super(UserSavedVoucher);
  }

  findByUserAndVoucher(userId, voucherId) {
    return this.findOneByFilter({ userId, voucherId });
  }

  async saveVoucher(userId, voucherId) {
    return this.model.findOneAndUpdate(
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

  async findSavedVoucherIdsByUserId(userId) {
    const list = await this.findManyByFilter({ userId }).select('voucherId').lean();
    return list.map((item) => item.voucherId.toString());
  }

  findSavedVouchersByUserId(userId) {
    return this.findManyByFilter({ userId })
      .populate({
        path: 'voucherId',
        populate: {
          path: 'shopId',
          select: 'name logo slug',
        },
      })
      .sort({ createdAt: -1 })
      .lean();
  }
}

module.exports = new UserSavedVoucherRepository();
