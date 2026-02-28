const Payment = require("../models/payment.model");
const BaseRepository = require("./base.repository");

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  findByTransactionId(transactionId) {
    return this.findOneByFilter({ transactionId });
  }

  findByOrderIdWithOrderAndUser(orderId) {
    return this.findOneByFilter({ orderId })
      .populate("orderId")
      .populate("userId", "email name");
  }

  findByTransactionIdWithOrderAndUser(transactionId) {
    return this.findOneByFilter({ transactionId })
      .populate("orderId")
      .populate("userId", "email name");
  }
}

module.exports = new PaymentRepository();
