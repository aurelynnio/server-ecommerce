const notificationService = require("../services/notification.service");
const catchAsync = require("../configs/catchAsync");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Notification Controller
 * Handles notification operations for users
 */
const NotificationController = {
  /**
   * Create a new notification
   * @access Private (requires authentication)
   */
  createNotification: catchAsync(async (req, res) => {
    const notification = await notificationService.createNotification({
      ...req.body,
      userId: req.user.userId,
    });

    return sendSuccess(
      res,
      notification,
      "Notification created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get list of notifications for current user
   * @access Private (requires authentication)
   */
  getListNotification: catchAsync(async (req, res) => {
    const result = await notificationService.getListNotification(
      req.user.userId,
      {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
      }
    );

    // Service already returns proper structure: { data, pagination, metadata }
    const response = {
      data: result.data,
      pagination: result.pagination,
      unreadCount: result.metadata?.unreadCount || 0,
    };

    return sendSuccess(
      res,
      response,
      "Get list notification successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Mark all notifications as read
   * @access Private (requires authentication)
   */
  markReadAll: catchAsync(async (req, res) => {
    await notificationService.markReadAll(req.user.userId);

    return sendSuccess(
      res,
      null,
      "Mark all notifications as read successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Delete all notifications for current user
   * @access Private (requires authentication)
   */
  cleanNotification: catchAsync(async (req, res) => {
    await notificationService.cleanNotification(req.user.userId);

    return sendSuccess(
      res,
      null,
      "Clean all notifications successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Count unread notifications
   * @access Private (requires authentication)
   */
  countUnread: catchAsync(async (req, res) => {
    const count = await notificationService.countUnread(req.user.userId);

    return sendSuccess(
      res,
      { count },
      "Count unread notifications successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get notification by ID
   * @access Private (requires authentication)
   */
  getNotificationById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const notification = await notificationService.getNotificationById(
      id,
      req.user.userId
    );
    return sendSuccess(
      res,
      notification,
      "Get notification details successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update notification by ID
   * @access Private (requires authentication)
   */
  updateNotification: catchAsync(async (req, res) => {
    const { id } = req.params;

    const notification = await notificationService.updateNotification(
      id,
      req.user.userId,
      req.body
    );
    return sendSuccess(
      res,
      notification,
      "Update notification successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = NotificationController;
