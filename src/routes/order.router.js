const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');
const {
  verifyShopOwnership,
  verifyOrderOwnership,
} = require('../middlewares/ownership.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createOrderValidator,
  updateOrderStatusValidator,
  orderIdParamValidator,
  getOrdersQueryValidator,
} = require('../validations/order.validator');

const verifyShopOwnershipForSeller = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return verifyShopOwnership(req, res, next);
};

/**
 * @desc    Create a new order from cart items
 * @access  Private
 */
router.post('/', verifyAccessToken, validate(createOrderValidator), orderController.createOrder);

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
 * @desc    Update order status by seller
 * @access  Private (Seller)
 */
router.put(
  '/seller/:orderId/status',
  verifyAccessToken,
  requireRole('seller', 'admin'),
  verifyShopOwnership,
  verifyOrderOwnership,
  validate({
    params: orderIdParamValidator,
    body: updateOrderStatusValidator,
  }),
  orderController.updateOrderStatusBySeller,
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
