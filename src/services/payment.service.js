const { VNPay, ProductCode, VnpLocale, dateFormat, getDateInGMT7 } = require('vnpay');
const Payment = require('../repositories/payment.repository');
const Order = require('../repositories/order.repository');
const orderService = require('./order.service');
const { getIO } = require('../socket/index');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');

/**
 * PERFORMANCE FIX: Singleton VNPay instance - reuse across requests
 */
let vnpayInstance = null;

/**
 * Get or create VNPay instance (singleton pattern)
 * @returns {Object} VNPay instance
 */
const getVNPayInstance = () => {
  /**
   * If
   * @param {any} !vnpayInstance
   * @returns {any}
   */
  if (!vnpayInstance) {
    vnpayInstance = new VNPay({
      tmnCode: process.env.VNP_TMNCODE,
      secureSecret: process.env.VNP_HASHSECRET,
      vnpayHost: 'https://sandbox.vnpayment.vn',
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
   * Create VNPay payment URL and save payment record
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID
   * @param {string} ipAddress - Client IP address
   * @returns {Promise<Object>} Payment record with payment URL
   * @throws {Error} If order invalid, unauthorized, or already paid
   */
  async createPaymentUrl(orderId, userId, ipAddress) {
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

    // PERFORMANCE FIX: Use singleton VNPay instance
    const vnpay = getVNPayInstance();

    const transactionId = `${orderId}_${Date.now()}`;

    // Generate dates in GMT+7 to avoid timezone issues (especially if server is in UTC)
    const createDate = getDateInGMT7(new Date());
    const expireDate = getDateInGMT7(new Date(Date.now() + 15 * 60 * 1000));

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

    const order = await Order.findById(payment.orderId);
    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
    }

    const isSuccess = responseCode === '00' && transactionStatus === '00';

    payment.status = isSuccess ? 'completed' : 'failed';
    payment.gatewayData = vnpayParams;
    payment.paymentDate = new Date();
    await payment.save();

    if (isSuccess) {
      const previousStatus = order.status;
      const previousPaymentStatus = order.paymentStatus;
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
      if (previousStatus !== order.status || previousPaymentStatus !== order.paymentStatus) {
        await orderService.publishOrderStatusChangedEvent(order, previousStatus, 'system');
      }

      // Emit socket event to update dashboard
      try {
        const io = getIO();
        io.emit('new_order', {
          orderId: order._id,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        });
      } catch (error) {
        logger.error('Socket emit error:', { error: error.message });
      }
    }

    return {
      success: isSuccess,
      payment,
      order,
      message: isSuccess ? 'Payment successful' : 'Payment failed',
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

    const order = await Order.findById(payment.orderId);
    if (!order) {
      return {
        RspCode: '01',
        Message: 'Order not found',
      };
    }

    const isSuccess = responseCode === '00';

    payment.status = isSuccess ? 'completed' : 'failed';
    payment.gatewayData = vnpayParams;
    payment.paymentDate = new Date();
    await payment.save();

    if (isSuccess) {
      const previousStatus = order.status;
      const previousPaymentStatus = order.paymentStatus;
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
      if (previousStatus !== order.status || previousPaymentStatus !== order.paymentStatus) {
        await orderService.publishOrderStatusChangedEvent(order, previousStatus, 'system');
      }
    }

    return {
      RspCode: '00',
      Message: 'Confirm success',
    };
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
