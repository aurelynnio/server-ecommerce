const { ProductCode, VnpLocale, dateFormat } = require("vnpay");
const catchAsync = require("../configs/catchAsync");
const PaymentService = require("../services/payment.service");
const { VNPay } = require("vnpay");
const { StatusCodes } = require("http-status-codes");

/**
 * Payment Controller
 * Handles VNPay payment operations including creation, callbacks, and retrieval
 */
const PaymentController = {
  /**
   * Create payment URL for VNPay

* @access  Private (Authenticated users)


   */
  createPayment: catchAsync(async (req, res) => {
    const { orderId } = req.body;
    const userId = req.user.userId; // From auth middleware

    // Get client IP address
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip;

    // Create payment URL
    const payment = await PaymentService.createPaymentUrl(
      orderId,
      userId,
      ipAddress
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Payment URL created successfully",
      data: {
        paymentUrl: payment.paymentUrl,
        transactionId: payment.transactionId,
        amount: payment.amount,
      },
    });
  }),

  /**
   * Handle VNPay return callback (user redirect after payment)

* @access  Public


   */
  handleVnpayReturn: catchAsync(async (req, res) => {
    const vnpayParams = req.query;

    try {
      // Verify and process payment
      const result = await PaymentService.verifyReturnUrl(vnpayParams);

      // Redirect to frontend with result
      const clientUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const status = result.success ? "success" : "failed";
      const redirectUrl = `${clientUrl}/payment/${status}?orderId=${result.order._id}&transactionId=${result.payment.transactionId}`;

      res.redirect(redirectUrl);
    } catch (error) {
      // Redirect to error page
      const clientUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const redirectUrl = `${clientUrl}/payment/error?message=${encodeURIComponent(
        error.message
      )}`;
      res.redirect(redirectUrl);
    }
  }),

  /**
   * Handle VNPay IPN (Instant Payment Notification)

* @access  Public


   */
  handleVnpayIPN: catchAsync(async (req, res) => {
    const vnpayParams = req.query;

    // Process IPN
    const result = await PaymentService.handleIPN(vnpayParams);

    // Return response to VNPay
    res.status(StatusCodes.OK).json(result);
  }),

  /**
   * Get payment details by order ID

* @access  Private (Owner or Admin)


   */
  getPaymentByOrder: catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const payment = await PaymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check if user owns this payment
    if (
      payment.userId._id.toString() !== userId.toString() &&
      !req.user.isAdmin
    ) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: payment,
    });
  }),
};

module.exports = PaymentController;
