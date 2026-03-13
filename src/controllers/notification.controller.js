const notificationService = require('../services/notification.service');
const catchAsync = require('../configs/catchAsync');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess } = require('../shared/res/formatResponse');

const NotificationController = {
  /**
   * Create notification
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  createNotification: catchAsync(async (req, res) => {
    const { recipient, ...notificationPayload } = req.body;

    const notification = await notificationService.publishNotification(
      {
        ...notificationPayload,
        userId: recipient || req.user.userId,
      },
      'notification.created',
    );
    return sendSuccess(res, notification, 'Notification queued successfully', StatusCodes.CREATED);
  }),

  /**
   * Get list notification
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getListNotification: catchAsync(async (req, res) => {
    const result = await notificationService.getListNotification(req.user.userId, {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    });

    const response = {
      data: result.data,
      pagination: result.pagination,
      unreadCount: result.metadata?.unreadCount || 0,
    };

    return sendSuccess(res, response, 'Get list notification successfully', StatusCodes.OK);
  }),

  /**
   * Mark read all
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  markReadAll: catchAsync(async (req, res) => {
    await notificationService.markReadAll(req.user.userId);

    return sendSuccess(res, null, 'Mark all notifications as read successfully', StatusCodes.OK);
  }),

  /**
   * Clean notification
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  cleanNotification: catchAsync(async (req, res) => {
    await notificationService.cleanNotification(req.user.userId);

    return sendSuccess(res, null, 'Clean all notifications successfully', StatusCodes.OK);
  }),

  /**
   * Count unread
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  countUnread: catchAsync(async (req, res) => {
    const count = await notificationService.countUnread(req.user.userId);

    return sendSuccess(res, { count }, 'Count unread notifications successfully', StatusCodes.OK);
  }),

  /**
   * Get notification by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getNotificationById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const notification = await notificationService.getNotificationById(id, req.user.userId);
    return sendSuccess(res, notification, 'Get notification details successfully', StatusCodes.OK);
  }),

  /**
   * Update notification
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateNotification: catchAsync(async (req, res) => {
    const { id } = req.params;

    const notification = await notificationService.updateNotification(
      id,
      req.user.userId,
      req.body,
    );
    return sendSuccess(res, notification, 'Update notification successfully', StatusCodes.OK);
  }),
};

module.exports = NotificationController;
