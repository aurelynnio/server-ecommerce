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
   * @access Private (requires authentication)
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
   * @access Private (Admin only)
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
   * @access Private (requires authentication)
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
   * @access Private (Owner or Admin)
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
   * @access Private (Admin or Seller)
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
   * @access Private (Owner or Admin)
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
   * @access Private (Admin only)
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
   * @access Private (Seller only)
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
   * @access Private (Seller only)
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
   * @access Private (Seller only)
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
