const catchAsync = require('../configs/catchAsync');
const PaymentService = require('../services/payment.service');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess, sendJson } = require('../shared/res/formatResponse');
const { getRequestUserId } = require('../utils/user.util');

const getClientUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

const buildPaymentResultUrl = ({ status, orderId, orderGroupId, transactionId }) => {
  const clientUrl = getClientUrl();
  const query = new URLSearchParams({
    orderId: String(orderId || ''),
    orderGroupId: String(orderGroupId || ''),
    transactionId: String(transactionId || ''),
  });

  return `${clientUrl}/payment/${status}?${query.toString()}`;
};

const buildPaymentErrorUrl = (message) => {
  const clientUrl = getClientUrl();
  const query = new URLSearchParams({ message: message || 'Payment failed' });
  return `${clientUrl}/payment/error?${query.toString()}`;
};

const PaymentController = {
  /**
   * Create payment for an order or order group
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createPayment: catchAsync(async (req, res) => {
    const { orderId, orderGroupId } = req.body;
    const userId = getRequestUserId(req.user);

    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    const payment = await PaymentService.createPaymentUrl({
      orderId,
      orderGroupId,
      userId,
      ipAddress,
    });

    return sendSuccess(
      res,
      {
        paymentUrl: payment.paymentUrl,
        transactionId: payment.transactionId,
        amount: payment.amount,
        orderId: payment.orderId,
        orderGroupId: payment.orderGroupId,
      },
      'Payment URL created successfully',
      StatusCodes.OK,
    );
  }),

  /**
   * Handle vnpay return
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  handleVnpayReturn: catchAsync(async (req, res) => {
    const vnpayParams = req.query;

    try {
      const result = await PaymentService.verifyReturnUrl(vnpayParams);

      const status = result.success ? 'success' : 'failed';
      const redirectUrl = buildPaymentResultUrl({
        status,
        orderId: result.order?._id,
        orderGroupId: result.payment?.orderGroupId,
        transactionId: result.payment?.transactionId,
      });

      return res.redirect(redirectUrl);
    } catch (error) {
      return res.redirect(buildPaymentErrorUrl(error.message));
    }
  }),

  /**
   * Handle vnpay ipn
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  handleVnpayIPN: catchAsync(async (req, res) => {
    const vnpayParams = req.query;

    const result = await PaymentService.handleIPN(vnpayParams);

    return sendJson(res, result, StatusCodes.OK);
  }),

  /**
   * Get payment by order
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getPaymentByOrder: catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const userId = getRequestUserId(req.user);
    const isAdmin = req.user?.roles === 'admin';

    const payment = await PaymentService.getPaymentByOrderId(orderId, userId, isAdmin);
    return sendSuccess(res, payment, 'Get payment details successfully');
  }),

  /**
   * Get payment by order group
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getPaymentByOrderGroup: catchAsync(async (req, res) => {
    const { orderGroupId } = req.params;
    const userId = getRequestUserId(req.user);
    const isAdmin = req.user?.roles === 'admin';

    const payment = await PaymentService.getPaymentByOrderGroupId(orderGroupId, userId, isAdmin);
    return sendSuccess(res, payment, 'Get payment details successfully');
  }),
};

module.exports = PaymentController;
