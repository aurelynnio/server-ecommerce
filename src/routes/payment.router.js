const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/payment.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { sensitiveLimiter } = require('../middlewares/rateLimited.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createPaymentValidator,
  paymentOrderIdParamValidator,
} = require('../validations/payment.validator');

/**
 * @desc    Create payment for an order
 * @access  Private
 */
router.post(
  '/',
  verifyAccessToken,
  sensitiveLimiter,
  validate(createPaymentValidator),
  PaymentController.createPayment,
);

/**
 * @desc    Get payment details by order ID
 * @access  Private
 * @param   orderId - Order ID
 */
router.get(
  '/order/:orderId',
  verifyAccessToken,
  sensitiveLimiter,
  validate({ params: paymentOrderIdParamValidator }),
  PaymentController.getPaymentByOrder,
);

/**
 * @desc    VNPay return handler (client redirect)
 * @access  Public
 */
router.get('/vnpay-return', PaymentController.handleVnpayReturn);

/**
 * @desc    VNPay IPN handler (server callback)
 * @access  Public
 */
router.get('/vnpay-ipn', PaymentController.handleVnpayIPN);

module.exports = router;
