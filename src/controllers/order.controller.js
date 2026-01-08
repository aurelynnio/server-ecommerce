const catchAsync = require("../configs/catchAsync");
const orderService = require("../services/order.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Order Controller
 * Handles order creation, retrieval, status updates, and statistics
 */
const OrderController = {
  /**
   * Create order from cart items
   * @route POST /api/orders
   * @access Private (requires authentication)
   * @body {string[]} cartItemIds - Cart item IDs to checkout
   * @body {Object} shippingAddress - Shipping address details
   * @body {string} [paymentMethod="cod"] - Payment method
   * @body {Array} [shopVouchers] - Shop-specific vouchers
   * @body {string} [platformVoucher] - Platform voucher code
   * @returns {Object} Created orders with group ID
   */
  createOrder: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const order = await orderService.createOrder(userId, req.body);

    return sendSuccess(
      res,
      order,
      "Order created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get all orders (Admin only)
   * @route GET /api/orders/admin
   * @access Private (Admin only)
   * @query {Object} [filters] - Optional filters
   * @returns {Object} All orders
   */
  getAllOrders: catchAsync(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);

    return sendSuccess(
      res,
      result,
      "Orders retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get current user's orders
   * @route GET /api/orders/my-orders
   * @access Private (requires authentication)
   * @query {Object} [filters] - Optional filters
   * @returns {Object} User's orders
   */
  getUserOrders: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await orderService.getUserOrders(userId, req.query);

    return sendSuccess(
      res,
      result,
      "Orders retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get single order by ID
   * @route GET /api/orders/:orderId
   * @access Private (Owner or Admin)
   * @param {string} orderId - Order ID
   * @returns {Object} Order details
   */
  getOrderById: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === "admin";
    const order = await orderService.getOrderById(
      req.params.orderId,
      userId,
      isAdmin
    );

    return sendSuccess(
      res,
      order,
      "Order retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update order status
   * @route PUT /api/orders/:orderId/status
   * @access Private (Admin or Seller)
   * @param {string} orderId - Order ID
   * @body {string} status - New status (confirmed, processing, shipped, delivered, cancelled)
   * @returns {Object} Updated order
   */
  updateOrderStatus: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === "admin";
    const shopId = req.user.shopId || null; // Seller's shop ID if applicable

    const order = await orderService.updateOrderStatus(
      req.params.orderId,
      req.body.status,
      userId,
      isAdmin,
      shopId
    );

    return sendSuccess(
      res,
      order,
      "Order status updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Cancel an order
   * @route PUT /api/orders/:orderId/cancel
   * @access Private (Owner or Admin)
   * @param {string} orderId - Order ID
   * @returns {Object} Cancelled order
   */
  cancelOrder: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === "admin";
    const order = await orderService.cancelOrder(
      req.params.orderId,
      userId,
      isAdmin
    );

    return sendSuccess(
      res,
      order,
      "Order cancelled successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get order statistics for admin dashboard
   * @route GET /api/orders/statistics
   * @access Private (Admin only)
   * @returns {Object} Order statistics (totals, revenue, top products, etc.)
   */
  getOrderStatistics: catchAsync(async (req, res) => {
    const stats = await orderService.getOrderStatistics();

    return sendSuccess(
      res,
      stats,
      "Order statistics retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get orders for seller's shop
   * @route GET /api/orders/seller/list
   * @access Private (Seller only)
   * @returns {Object} Shop's orders
   */
  getSellerOrders: catchAsync(async (req, res) => {
    const shopId = req.shop._id;
    const result = await orderService.getOrdersByShop(shopId, req.query);

    return sendSuccess(
      res,
      result,
      "Orders retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update order status by seller
   * @route PUT /api/orders/seller/:orderId/status
   * @access Private (Seller only)
   * @param {string} orderId - Order ID
   * @body {string} status - New status
   * @returns {Object} Updated order
   */
  updateOrderStatusBySeller: catchAsync(async (req, res) => {
    const shopId = req.shop._id;
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await orderService.updateOrderStatusBySeller(
      orderId,
      shopId,
      status
    );

    return sendSuccess(
      res,
      order,
      "Order status updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get order statistics for seller's shop
   * @route GET /api/orders/seller/statistics
   * @access Private (Seller only)
   * @returns {Object} Shop's order statistics
   */
  getSellerOrderStatistics: catchAsync(async (req, res) => {
    const shopId = req.shop._id;
    const stats = await orderService.getSellerOrderStatistics(shopId);

    return sendSuccess(
      res,
      stats,
      "Order statistics retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = OrderController;
