const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createOrderValidator,
  updateOrderStatusValidator,
  orderIdParamValidator,
  getOrdersQueryValidator,
} = require("../validations/order.validator");

// User routes (require authentication)
router.post(
  "/",
  verifyAccessToken,
  validate(createOrderValidator),
  orderController.createOrder
);
router.get(
  "/",
  verifyAccessToken,
  validate({ query: getOrdersQueryValidator }),
  orderController.getUserOrders
);
router.get(
  "/:orderId",
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.getOrderById
);
router.delete(
  "/:orderId/cancel",
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.cancelOrder
);

// Admin routes (require admin role)
router.get(
  "/all/list",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: getOrdersQueryValidator }),
  orderController.getAllOrders
);
router.put(
  "/:orderId/status",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: orderIdParamValidator,
    body: updateOrderStatusValidator,
  }),
  orderController.updateOrderStatus
);
router.get(
  "/statistics/overview",
  verifyAccessToken,
  requireRole("admin"),
  orderController.getOrderStatistics
);

module.exports = router;

