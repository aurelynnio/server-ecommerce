const catchAsync = require('../configs/catchAsync');
const orderService = require('../services/order.service');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess } = require('../shared/res/formatResponse');

const OrderController = {
  /**
   * Create order
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createOrder: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const order = await orderService.createOrder(userId, req.body);

    return sendSuccess(res, order, 'Order created successfully', StatusCodes.CREATED);
  }),

  /**
   * Get all orders
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getAllOrders: catchAsync(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);

    return sendSuccess(res, result, 'Orders retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get user orders
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getUserOrders: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await orderService.getUserOrders(userId, req.query);

    return sendSuccess(res, result, 'Orders retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get order by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getOrderById: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';
    const order = await orderService.getOrderById(req.params.orderId, userId, isAdmin);

    return sendSuccess(res, order, 'Order retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Cancel order
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  cancelOrder: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';
    const order = await orderService.cancelOrder(req.params.orderId, userId, isAdmin);

    return sendSuccess(res, order, 'Order cancelled successfully', StatusCodes.OK);
  }),

  /**
   * Get order statistics
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getOrderStatistics: catchAsync(async (req, res) => {
    const stats = await orderService.getOrderStatistics();

    return sendSuccess(res, stats, 'Order statistics retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get seller orders
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSellerOrders: catchAsync(async (req, res) => {
    const shopId = req.shop._id;
    const result = await orderService.getOrdersByShop(shopId, req.query);

    return sendSuccess(res, result, 'Orders retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Update order status by seller
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateOrderStatusBySeller: catchAsync(async (req, res) => {
    const shopId = req.shop._id;
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await orderService.updateOrderStatusBySeller(orderId, shopId, status);

    return sendSuccess(res, order, 'Order status updated successfully', StatusCodes.OK);
  }),

  /**
   * Get seller order statistics
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSellerOrderStatistics: catchAsync(async (req, res) => {
    const shopId = req.shop._id;
    const stats = await orderService.getSellerOrderStatistics(shopId);

    return sendSuccess(res, stats, 'Order statistics retrieved successfully', StatusCodes.OK);
  }),
};

module.exports = OrderController;
