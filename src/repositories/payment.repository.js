const Payment = require('../models/payment.model');
const BaseRepository = require('./base.repository');

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  findByTransactionId(transactionId) {
    return this.findOneByFilter({ transactionId });
  }

  findByOrderGroupId(orderGroupId) {
    return this.findOneByFilter({ orderGroupId });
  }

  findByOrderIdWithOrderAndUser(orderId) {
    return this.findOneByFilter({ orderId })
      .populate('orderId')
      .populate('userId', 'email name')
      .lean();
  }

  findByOrderGroupIdWithOrdersAndUser(orderGroupId) {
    return this.findOneByFilter({ orderGroupId })
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
