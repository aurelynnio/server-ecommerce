const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/payment.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createPaymentValidator,
  paymentOrderIdParamValidator,
} = require("../validations/payment.validator");

// Protected routes (require authentication)
router.post(
  "/create",
  verifyAccessToken,
  validate(createPaymentValidator),
  PaymentController.createPayment
);
router.get(
  "/order/:orderId",
  verifyAccessToken,
  validate({ params: paymentOrderIdParamValidator }),
  PaymentController.getPaymentByOrder
);

// Public routes (VNPay callbacks)
router.get("/vnpay-return", PaymentController.handleVnpayReturn);
router.get("/vnpay-ipn", PaymentController.handleVnpayIPN);

module.exports = router;

