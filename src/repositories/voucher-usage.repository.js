const VoucherUsage = require('../models/voucher-usage.model');
const BaseRepository = require('./base.repository');

class VoucherUsageRepository extends BaseRepository {
  constructor() {
    super(VoucherUsage);
  }

  countByVoucherAndUser(voucherId, userId) {
    return this.countByFilter({ voucherId, userId });
  }

  /**
   * Xóa usage record gắn với 1 đơn cụ thể (voucher shop) khi rollback
   */
  deleteByVoucherUserAndOrder(voucherId, userId, orderId) {
    return this.deleteOneByFilter({ voucherId, userId, orderId });
  }

  /**
   * Xóa usage record gắn với cả order group (voucher platform) khi rollback
   */
  deleteByVoucherUserAndOrderGroup(voucherId, userId, orderGroupId) {
    return this.deleteOneByFilter({ voucherId, userId, orderGroupId });
  }

  aggregateUsageByVoucherIdsAndUser(voucherIds, userObjectId) {
    return this.aggregateByPipeline([
      { $match: { voucherId: { $in: voucherIds }, userId: userObjectId } },
      { $group: { _id: '$voucherId', count: { $sum: 1 } } },
    ]);
  }
}

module.exports = new VoucherUsageRepository();
