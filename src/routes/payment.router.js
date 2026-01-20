
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
* @desc Create payment URL for VNPay
* @accessPrivate (Authenticated users)
 * @body    { orderId }
 */

router.post(
  "/create",
  verifyAccessToken,
  validate(createPaymentValidator),
  PaymentController.createPayment
);
/**
* @desc Get payment details by order ID
* @accessPrivate (Authenticated users - own orders, Admin - all orders)
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
* @desc Handle VNPay return callback (user redirect after payment)
* @accessPublic
 * @query   VNPay response parameters
 */

router.get("/vnpay-return", PaymentController.handleVnpayReturn);
/**
* @desc Handle VNPay IPN (Instant Payment Notification)
* @accessPublic
 * @query   VNPay IPN parameters
 */

router.get("/vnpay-ipn", PaymentController.handleVnpayIPN);

module.exports = router;
