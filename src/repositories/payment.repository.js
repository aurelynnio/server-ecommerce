const Payment = require('../models/payment.model');
const BaseRepository = require('./base.repository');

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  findByTransactionId(transactionId) {
    return this.findOneByFilter({ transactionId });
  }

  findByOrderIdWithOrderAndUser(orderId) {
    return this.findOneByFilter({ orderId })
      .sort({ createdAt: -1 })
      .populate('orderId')
      .populate('userId', 'email name')
      .lean();
  }

  findByOrderGroupIdWithOrdersAndUser(orderGroupId) {
    return this.findOneByFilter({ orderGroupId })
      .sort({ createdAt: -1 })
      .populate('orderIds')
      .populate('userId', 'email name')
      .lean();
  }

  findByTransactionIdWithOrderAndUser(transactionId) {
    return this.findOneByFilter({ transactionId })
      .populate('orderId')
      .populate('orderIds')
      .populate('userId', 'email name')
      .lean();
  }
}

module.exports = new PaymentRepository();
