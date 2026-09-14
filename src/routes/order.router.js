const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');
const {
  verifyShopOwnership,
  verifyOrderOwnership,
} = require('../middlewares/ownership.middleware');
const validate = require('../middlewares/validate.middleware');
const idempotency = require('../middlewares/idempotency.middleware');
const { isRequestUserAdmin } = require('../utils/requestUser');
const {
  createOrderValidator,
  buyNowValidator,
  updateOrderStatusValidator,
  orderIdParamValidator,
  getOrdersQueryValidator,
  trackingIdParamValidator,
} = require('../validations/order.validator');

const verifyShopOwnershipForSeller = (req, res, next) => {
  if (isRequestUserAdmin(req.user)) return next();
  return verifyShopOwnership(req, res, next);
};

/**
 * @desc    Create a new order from cart items
 * @access  Private
 */
router.post(
  '/',
  verifyAccessToken,
  idempotency(),
  validate(createOrderValidator),
  orderController.createOrder,
);

/**
 * @desc    Buy now - direct checkout without cart
 * @access  Private
 */
router.post(
  '/buy-now',
  verifyAccessToken,
  idempotency(),
  validate(buyNowValidator),
  orderController.buyNow,
);

/**
 * @desc    Get current user's orders with pagination
 * @access  Private
 */
router.get(
  '/',
  verifyAccessToken,
  validate({ query: getOrdersQueryValidator }),
  orderController.getUserOrders,
);

/**
 * @desc    Get order tracking status (for async order queue)
 * @access  Private
 * @deprecated Use WebSocket real-time events (`order_created`, `order_failed`) instead of polling Redis
 */
router.get(
  '/tracking/:trackingId',
  verifyAccessToken,
  validate({ params: trackingIdParamValidator }),
  orderController.getOrderTrackingStatus,
);

/**
 * @desc    Get order details by ID
 * @access  Private
 */
router.get(
  '/:orderId',
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.getOrderById,
);

/**
 * @desc    Cancel an order
 * @access  Private
 */
router.delete(
  '/:orderId/cancel',
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.cancelOrder,
);

/**
 * @desc    Confirm delivery by current user
 * @access  Private
 */
router.post(
  '/:orderId/confirm-delivery',
  verifyAccessToken,
  validate({ params: orderIdParamValidator }),
  orderController.confirmDelivery,
);

/**
 * @desc    Get all orders with filters (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/all/list',
  verifyAccessToken,
  requireRole('admin'),
  validate({ query: getOrdersQueryValidator }),
  orderController.getAllOrders,
);

/**
 * @desc    Get orders for seller's shop
 * @access  Private (Seller)
 */
router.get(
  '/seller/list',
  verifyAccessToken,
  requireRole('seller', 'admin'),
  verifyShopOwnership,
  validate({ query: getOrdersQueryValidator }),
  orderController.getSellerOrders,
);

/**
 * @desc    Get order statistics for seller's shop
 * @access  Private (Seller)
 */
router.get(
  '/seller/statistics',
  verifyAccessToken,
  requireRole('seller', 'admin'),
  verifyShopOwnership,
  orderController.getSellerOrderStatistics,
);

/**
 * @desc    Update order status by admin or seller
 * @access  Private (Admin/Seller)
 */
router.put(
  '/:orderId/status',
  verifyAccessToken,
  requireRole('seller', 'admin'),
  verifyShopOwnershipForSeller,
  validate({
    params: orderIdParamValidator,
    body: updateOrderStatusValidator,
  }),
  orderController.updateOrderStatus,
);

/**
 * @desc    Update order status by seller (dùng chung handler updateOrderStatus)
 * @access  Private (Seller)
 */
const verifyOrderOwnershipForSeller = (req, res, next) => {
  if (isRequestUserAdmin(req.user)) return next();
  return verifyOrderOwnership(req, res, next);
};

router.put(
  '/seller/:orderId/status',
  verifyAccessToken,
  requireRole('seller', 'admin'),
  verifyShopOwnershipForSeller,
  verifyOrderOwnershipForSeller,
  validate({
    params: orderIdParamValidator,
    body: updateOrderStatusValidator,
  }),
  orderController.updateOrderStatus,
);

/**
 * @desc    Get order statistics overview
 * @access  Private (Admin)
 */
router.get(
  '/statistics/overview',
  verifyAccessToken,
  requireRole('admin'),
  orderController.getOrderStatistics,
);

module.exports = router;
