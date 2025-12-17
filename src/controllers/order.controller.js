const catchAsync = require("../configs/catchAsync");
const orderService = require("../services/order.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");


const OrderController = {
  // Create order from cart
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

  // Get all orders (Admin only)
  getAllOrders: catchAsync(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);

    return sendSuccess(
      res,
      result,
      "Orders retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get user's orders
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

  // Get single order by ID
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

  // Update order status (Admin only)
  updateOrderStatus: catchAsync(async (req, res) => {
    const order = await orderService.updateOrderStatus(req.params.orderId, req.body.status);

    return sendSuccess(
      res,
      order,
      "Order status updated successfully",
      StatusCodes.OK
    );
  }),

  // Cancel order
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

  // Get order statistics (Admin only)
  getOrderStatistics: catchAsync(async (req, res) => {
    const stats = await orderService.getOrderStatistics();

    return sendSuccess(
      res,
      stats,
      "Order statistics retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = OrderController;
