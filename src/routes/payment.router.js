const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/payment.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createPaymentValidator,
  paymentOrderIdParamValidator,
  paymentOrderGroupIdParamValidator,
} = require('../validations/payment.validator');

/**
 * @desc    Create payment for an order or order group
 * @access  Private
 */
router.post(
  '/',
  verifyAccessToken,
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
  validate({ params: paymentOrderIdParamValidator }),
  PaymentController.getPaymentByOrder,
);

/**
 * @desc    Get payment details by order group ID
 * @access  Private
 * @param   orderGroupId - Order Group ID
 */
router.get(
  '/group/:orderGroupId',
  verifyAccessToken,
  validate({ params: paymentOrderGroupIdParamValidator }),
  PaymentController.getPaymentByOrderGroup,
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
