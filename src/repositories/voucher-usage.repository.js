const VoucherUsage = require('../models/voucher-usage.model');
const BaseRepository = require('./base.repository');

class VoucherUsageRepository extends BaseRepository {
  constructor() {
    super(VoucherUsage);
  }

  countByVoucherAndUser(voucherId, userId) {
    return this.countByFilter({ voucherId, userId });
  }

  aggregateUsageByVoucherIdsAndUser(voucherIds, userObjectId) {
    return this.aggregateByPipeline([
      { $match: { voucherId: { $in: voucherIds }, userId: userObjectId } },
      { $group: { _id: '$voucherId', count: { $sum: 1 } } },
    ]);
  }
}

module.exports = new VoucherUsageRepository();
