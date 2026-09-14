const { VNPay, ProductCode, VnpLocale, dateFormat, getDateInGMT7 } = require('vnpay');
const Payment = require('../repositories/payment.repository');
const Order = require('../repositories/order.repository');
const orderService = require('./order.service');
const { getIO } = require('../socket/index');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

/**
 * PERFORMANCE FIX: Singleton VNPay instance - reuse across requests
 */
let vnpayInstance = null;

/**
 * Get or create VNPay instance (singleton pattern)
 * @returns {Object} VNPay instance
 */
const getVNPayInstance = () => {
  if (!vnpayInstance) {
    vnpayInstance = new VNPay({
      tmnCode: process.env.VNP_TMNCODE,
      secureSecret: process.env.VNP_HASHSECRET,
      // Production phải set VNPAY_HOST=https://payment.vnpay.vn (mặc định sandbox
      // để giữ hành vi cũ khi chưa cấu hình)
      vnpayHost: process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn',
      testMode: process.env.NODE_ENV !== 'production',
      hashAlgorithm: 'SHA512',
    });
  }
  return vnpayInstance;
};

/**
 * Service handling payment operations
 * Integrates with VNPay for payment processing
 */
class PaymentService {
  /**
   * Create VNPay payment URL and save payment record.
   * Supports both single order payment and multi-vendor group checkout.
   * @param {string|Object} target - Order ID or options object { orderId, orderGroupId, userId, ipAddress }
   * @param {string} [userIdParam] - User ID (when target is orderId)
   * @param {string} [ipAddressParam] - Client IP address (when target is orderId)
   * @returns {Promise<Object>} Payment record with payment URL
   * @throws {Error} If order invalid, unauthorized, or already paid
   */
  async createPaymentUrl(target, userIdParam, ipAddressParam) {
    let orderId;
    let orderGroupId;
    let userId;
    let ipAddress;

    if (typeof target === 'object' && target !== null) {
      orderId = target.orderId;
      orderGroupId = target.orderGroupId;
      userId = target.userId;
      ipAddress = target.ipAddress;
    } else {
      orderId = target;
      userId = userIdParam;
      ipAddress = ipAddressParam;
    }

    const vnpay = getVNPayInstance();
    const createDate = getDateInGMT7(new Date());
    const expireDate = getDateInGMT7(new Date(Date.now() + 15 * 60 * 1000));

    // Multi-Vendor Group Payment Flow
    if (orderGroupId) {
      const orders = await Order.findManyByFilter({ orderGroupId });
      if (!orders || orders.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Orders not found for the specified group');
      }

      for (const ord of orders) {
        if (ord.userId.toString() !== userId.toString()) {
          throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized access to order group');
        }
        if (ord.paymentMethod !== 'vnpay') {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Order payment method is not VNPay');
        }
      }

      const allPaid = orders.every((o) => o.paymentStatus === 'paid');
      if (allPaid) {
        throw new ApiError(StatusCodes.CONFLICT, 'Order has already been paid');
      }

      const totalAmount = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const transactionId = `grp_${orderGroupId}_${Date.now()}`;

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: totalAmount,
        vnp_IpAddr: ipAddress,
        vnp_TxnRef: transactionId,
        vnp_OrderInfo: `Thanh toan don hang group ${orderGroupId}`,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl:
          process.env.VNP_RETURN_URL ||
          `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payment/vnpay-return`,
        vnp_Locale: VnpLocale.VN,
        vnp_CreateDate: dateFormat(createDate),
        vnp_ExpireDate: dateFormat(expireDate),
      });

      const payment = Payment.build({
        orderGroupId,
        orderIds: orders.map((o) => o._id),
        userId,
        amount: totalAmount,
        paymentMethod: 'vnpay',
        status: 'pending',
        transactionId,
        paymentUrl,
      });

      await payment.save();
      return payment;
    }

    // Single Order Payment Flow
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
    }

    if (order.userId.toString() !== userId.toString()) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized access to order');
    }

    if (order.paymentMethod !== 'vnpay') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Order payment method is not VNPay');
    }

    if (order.paymentStatus === 'paid') {
      throw new ApiError(StatusCodes.CONFLICT, 'Order has already been paid');
    }

    const transactionId = `${orderId}_${Date.now()}`;

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: order.totalAmount, // Library vnpayjs already handles multiplication by 100 internally
      vnp_IpAddr: ipAddress,
      vnp_TxnRef: transactionId,
      vnp_OrderInfo: `Thanh toan don hang ${order._id}`,
      vnp_OrderType: ProductCode.Other,
      vnp_ReturnUrl:
        process.env.VNP_RETURN_URL ||
        `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payment/vnpay-return`,
      vnp_Locale: VnpLocale.VN,
      vnp_CreateDate: dateFormat(createDate),
      vnp_ExpireDate: dateFormat(expireDate),
    });

    const payment = Payment.build({
      orderId: order._id,
      userId: order.userId,
      amount: order.totalAmount,
      paymentMethod: 'vnpay',
      status: 'pending',
      transactionId: transactionId,
      paymentUrl: paymentUrl,
    });

    await payment.save();

    return payment;
  }

  /**
   * Áp dụng kết quả thanh toán thành công lên order một cách an toàn:
   * - KHÔNG "hồi sinh" đơn đã bị hủy (stock của đơn hủy đã được hoàn lại,
   *   nếu set confirmed lại sẽ dẫn đến oversell)
   * - Dùng atomic update (compare-and-swap) để chống race với cancel/confirm
   *   chạy đồng thời tại thời điểm IPN/return URL về
   * @param {Object} order - Order document vừa load từ DB
   * @returns {Promise<{order: Object, cancelled: boolean}>}
   */
  async _applySuccessfulPayment(order) {
    // Case thường gặp: pending + unpaid → paid + confirmed (atomic)
    let updated = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pending', paymentStatus: 'unpaid' },
      { $set: { paymentStatus: 'paid', status: 'confirmed' } },
      { new: true },
    );

    if (updated) {
      await orderService.publishOrderStatusChangedEvent(updated, 'pending', 'system');
      return { order: updated, cancelled: false };
    }

    // Không match → có state change đồng thời, load lại state mới nhất
    const fresh = await Order.findById(order._id);
    if (!fresh) {
      return { order, cancelled: false };
    }

    // Đơn đã bị hủy trong lúc thanh toán: giữ nguyên trạng thái hủy,
    // payment vẫn ghi nhận completed để ops xử lý hoàn tiền.
    if (fresh.status === 'cancelled') {
      logger.error('[Payment] Successful payment arrived for cancelled order — refund required', {
        orderId: fresh._id?.toString(),
        paymentStatus: fresh.paymentStatus,
      });
      return { order: fresh, cancelled: true };
    }

    // Đơn đã được confirm trước đó (vd: seller confirm) → chỉ đánh dấu đã thanh toán,
    // không đổi status. Vẫn CAS để tránh ghi đè nếu đơn vừa bị hủy.
    if (fresh.paymentStatus !== 'paid') {
      updated = await Order.findOneAndUpdate(
        { _id: fresh._id, status: { $ne: 'cancelled' }, paymentStatus: { $ne: 'paid' } },
        { $set: { paymentStatus: 'paid' } },
        { new: true },
      );
      if (updated) {
        await orderService.publishOrderStatusChangedEvent(updated, updated.status, 'system');
      }
      return { order: updated || fresh, cancelled: false };
    }

    // Đã paid từ trước (vd: IPN xử lý trước return URL) — idempotent
    return { order: fresh, cancelled: false };
  }

  /**
   * Verify VNPay return URL callback
   * @param {Object} vnpayParams - VNPay callback parameters
   * @returns {Promise<Object>} Verification result
   * @throws {Error} If signature is invalid
   */
  async verifyReturnUrl(vnpayParams) {
    // PERFORMANCE FIX: Use singleton VNPay instance
    const vnpay = getVNPayInstance();

    const isValid = vnpay.verifyReturnUrl(vnpayParams);
    if (!isValid) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid signature');
    }

    const transactionId = vnpayParams.vnp_TxnRef;
    const responseCode = vnpayParams.vnp_ResponseCode;
    const transactionStatus = vnpayParams.vnp_TransactionStatus;

    const payment = await Payment.findByTransactionId(transactionId);
    if (!payment) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
    }

    // Defense-in-depth: xác nhận số tiền từ gateway khớp với payment record
    // (giống handleIPN) — chống amount tampering qua return URL
    const amount = parseInt(vnpayParams.vnp_Amount, 10) / 100;
    if (payment.amount !== amount) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid amount');
    }

    let orders = [];
    if (payment.orderGroupId) {
      orders = await Order.findManyByFilter({ orderGroupId: payment.orderGroupId });
      if (!orders || orders.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Orders not found for payment group');
      }
    } else {
      const order = await Order.findById(payment.orderId);
      if (!order) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
      }
      orders = [order];
    }

    const isSuccess = responseCode === '00' && transactionStatus === '00';

    // Idempotency: IPN có thể đã xử lý xong trước khi return URL về — không lưu lại payment
    if (payment.status === 'pending') {
      payment.status = isSuccess ? 'completed' : 'failed';
      payment.gatewayData = vnpayParams;
      payment.paymentDate = new Date();
      await payment.save();
    }

    let finalOrders = orders;
    let anyCancelled = false;

    // Áp dụng lên order khi gateway báo thành công VÀ payment record là completed.
    // _applySuccessfulPayment idempotent (CAS) nên gọi lại vẫn an toàn — kể cả khi
    // IPN đã xử lý trước nhưng crash trước khi kịp update order.
    if (isSuccess && payment.status === 'completed') {
      const results = await Promise.all(orders.map((ord) => this._applySuccessfulPayment(ord)));
      finalOrders = results.map((r) => r.order);
      anyCancelled = results.some((r) => r.cancelled);
    }

    if (isSuccess && !anyCancelled) {
      // Emit socket event to update dashboard
      try {
        const io = getIO();
        finalOrders.forEach((finalOrder) => {
          io.emit('new_order', {
            orderId: finalOrder._id,
            totalAmount: finalOrder.totalAmount,
            createdAt: finalOrder.createdAt,
          });
        });
      } catch (error) {
        logger.error('Socket emit error:', { error: error.message });
      }
    }

    return {
      success: isSuccess && !anyCancelled,
      payment,
      order: finalOrders[0],
      orders: finalOrders,
      message: anyCancelled
        ? 'Order was cancelled before payment completed. The transaction will be reviewed for refund.'
        : isSuccess
          ? 'Payment successful'
          : 'Payment failed',
    };
  }

  /**
   * Handle VNPay IPN (Instant Payment Notification)
   * @param {Object} vnpayParams - VNPay IPN parameters
   * @returns {Object} IPN response
   */
  async handleIPN(vnpayParams) {
    // PERFORMANCE FIX: Use singleton VNPay instance
    const vnpay = getVNPayInstance();

    const isValid = vnpay.verifyIpnCall(vnpayParams);
    if (!isValid) {
      return {
        RspCode: '97',
        Message: 'Invalid signature',
      };
    }

    const transactionId = vnpayParams.vnp_TxnRef;
    const responseCode = vnpayParams.vnp_ResponseCode;
    const amount = parseInt(vnpayParams.vnp_Amount) / 100;

    const payment = await Payment.findByTransactionId(transactionId);
    if (!payment) {
      return {
        RspCode: '01',
        Message: 'Order not found',
      };
    }

    if (payment.amount !== amount) {
      return {
        RspCode: '04',
        Message: 'Invalid amount',
      };
    }

    if (payment.status === 'completed') {
      return {
        RspCode: '02',
        Message: 'Order already confirmed',
      };
    }

    let orders = [];
    if (payment.orderGroupId) {
      orders = await Order.findManyByFilter({ orderGroupId: payment.orderGroupId });
      if (!orders || orders.length === 0) {
        return {
          RspCode: '01',
          Message: 'Order not found',
        };
      }
    } else {
      const order = await Order.findById(payment.orderId);
      if (!order) {
        return {
          RspCode: '01',
          Message: 'Order not found',
        };
      }
      orders = [order];
    }

    const isSuccess = responseCode === '00';

    payment.status = isSuccess ? 'completed' : 'failed';
    payment.gatewayData = vnpayParams;
    payment.paymentDate = new Date();
    await payment.save();

    if (isSuccess) {
      // Guard: không đổi trạng thái đơn đã hủy (chống oversell do stock đã hoàn)
      await Promise.all(orders.map((ord) => this._applySuccessfulPayment(ord)));
    }

    return {
      RspCode: '00',
      Message: 'Confirm success',
    };
  }

  /**
   * Get payment by order group ID
   * @param {string} orderGroupId - Order group ID
   * @param {string} [userId] - Current user ID for authorization check
   * @param {boolean} [isAdmin=false] - Whether current user is admin
   * @returns {Object} Payment record
   * @throws {Error} If unauthorized access
   */
  async getPaymentByOrderGroupId(orderGroupId, userId, isAdmin = false) {
    const payment = await Payment.findByOrderGroupIdWithOrdersAndUser(orderGroupId);

    if (!payment) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
    }

    if (userId && !isAdmin) {
      const paymentUserId = payment.userId?._id?.toString() || payment.userId?.toString();
      if (paymentUserId !== userId.toString()) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized access');
      }
    }

    return payment;
  }

  /**
   * Get payment by order ID
   * @param {string} orderId - Order ID
   * @param {string} [userId] - Current user ID for authorization check
   * @param {boolean} [isAdmin=false] - Whether current user is admin
   * @returns {Object} Payment record
   * @throws {Error} If unauthorized access
   */
  async getPaymentByOrderId(orderId, userId, isAdmin = false) {
    const payment = await Payment.findByOrderIdWithOrderAndUser(orderId);

    if (!payment) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
    }

    if (userId && !isAdmin) {
      const paymentUserId = payment.userId?._id?.toString() || payment.userId?.toString();
      if (paymentUserId !== userId.toString()) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized access');
      }
    }

    return payment;
  }

  /**
   * Get payment by transaction ID
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Payment record
   */
  async getPaymentByTransactionId(transactionId) {
    const payment = await Payment.findByTransactionIdWithOrderAndUser(transactionId);
    return payment;
  }
}

module.exports = new PaymentService();
