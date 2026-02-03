const catchAsync = require("../configs/catchAsync");
const PaymentService = require("../services/payment.service");
const { VNPay } = require("vnpay");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

const PaymentController = {
  /**
   * Create payment
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createPayment: catchAsync(async (req, res) => {
    const { orderId } = req.body;
    const userId = req.user.userId;

    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    const payment = await PaymentService.createPaymentUrl(
      orderId,
      userId,
      ipAddress
    );

    return sendSuccess(
      res,
      {
        paymentUrl: payment.paymentUrl,
        transactionId: payment.transactionId,
        amount: payment.amount,
      },
      "Payment URL created successfully",
      StatusCodes.OK
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

      const clientUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const status = result.success ? "success" : "failed";
      const redirectUrl = `${clientUrl}/payment/${status}?orderId=${result.order._id}&transactionId=${result.payment.transactionId}`;

      res.redirect(redirectUrl);
    } catch (error) {
      const clientUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const redirectUrl = `${clientUrl}/payment/error?message=${encodeURIComponent(
        error.message
      )}`;
      res.redirect(redirectUrl);
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

    res.status(StatusCodes.OK).json(result);
  }),

  /**
   * Get payment by order
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getPaymentByOrder: catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const payment = await PaymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      return sendFail(res, "Payment not found", StatusCodes.NOT_FOUND);
    }

    if (
      payment.userId._id.toString() !== userId.toString() &&
      !req.user.isAdmin
    ) {
      return sendFail(res, "Unauthorized access", StatusCodes.FORBIDDEN);
    }

    return sendSuccess(res, payment, "Get payment details successfully");
  }),
};

module.exports = PaymentController;
