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

/**
 * User Routes (Authenticated)
 */

/**
 * @route   POST /api/orders
 * @desc    Create a new order from cart items
 * @access  Private (Authenticated users)
 * @body    { cartItemIds, shippingAddress, paymentMethod, shopVouchers?, platformVoucher?, note? }
 */
router.post(
  "/",
  verifyAccessToken,
  validate(createOrderValidator),
  orderController.createOrder
);

/**
 * @route   GET /api/orders
 * @desc    Get current user's orders with pagination
 * @access  Private (Authenticated users)
 * @query   page, limit, status, paymentStatus, paymentMethod
 */
router.get(
  "/",
  verifyAccessToken,
  validate({ query: getOrdersQueryValidator }),
  orderController.getUserOrders
);

/**
 * @route   GET /api/orders/:orderId
 * @desc    Get order details by ID
 * @access  Private (Authenticated users - own orders, Admin - all orders)
 */
router.get(
  "/:orderId",
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.getOrderById
);

/**
 * @route   DELETE /api/orders/:orderId/cancel
 * @desc    Cancel an order
 * @access  Private (Authenticated users - own orders, Admin - all orders)
 */
router.delete(
  "/:orderId/cancel",
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.cancelOrder
);

/**
 * Admin Routes
 */

/**
 * @route   GET /api/orders/all/list
 * @desc    Get all orders with filters (Admin)
 * @access  Private (Admin only)
 * @query   page, limit, status, paymentStatus, paymentMethod, userId, search, startDate, endDate
 */
router.get(
  "/all/list",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: getOrdersQueryValidator }),
  orderController.getAllOrders
);

/**
 * @route   PUT /api/orders/:orderId/status
 * @desc    Update order status
 * @access  Private (Admin only)
 * @body    { status }
 */
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

/**
 * @route   GET /api/orders/statistics/overview
 * @desc    Get order statistics overview
 * @access  Private (Admin only)
 */
router.get(
  "/statistics/overview",
  verifyAccessToken,
  requireRole("admin"),
  orderController.getOrderStatistics
);

module.exports = router;
