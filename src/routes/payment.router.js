const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/payment.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createPaymentValidator,
  paymentOrderIdParamValidator,
} = require("../validations/payment.validator");

/**
 * Protected Routes (Authenticated users)
 */

/**
 * @route   POST /api/payment/create
 * @desc    Create payment URL for VNPay
 * @access  Private (Authenticated users)
 * @body    { orderId }
 */
router.post(
  "/create",
  verifyAccessToken,
  validate(createPaymentValidator),
  PaymentController.createPayment
);

/**
 * @route   GET /api/payment/order/:orderId
 * @desc    Get payment details by order ID
 * @access  Private (Authenticated users - own orders, Admin - all orders)
 * @param   orderId - Order ID to get payment for
 */
router.get(
  "/order/:orderId",
  verifyAccessToken,
  validate({ params: paymentOrderIdParamValidator }),
  PaymentController.getPaymentByOrder
);

/**
 * Public Routes (VNPay callbacks)
 */

/**
 * @route   GET /api/payment/vnpay-return
 * @desc    Handle VNPay return callback (user redirect after payment)
 * @access  Public
 * @query   VNPay response parameters
 */
router.get("/vnpay-return", PaymentController.handleVnpayReturn);

/**
 * @route   GET /api/payment/vnpay-ipn
 * @desc    Handle VNPay IPN (Instant Payment Notification)
 * @access  Public
 * @query   VNPay IPN parameters
 */
router.get("/vnpay-ipn", PaymentController.handleVnpayIPN);

module.exports = router;

