const notificationService = require("../services/notification.service");
const catchAsync = require("../configs/catchAsync");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");


const notificationController = {
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

  getListNotification: catchAsync(async (req, res) => {


    const result = await notificationService.getListNotification(req.user.userId, {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    });

    // Transform result to match standard pagination structure
    const response = {
      data: result.notifications,
      pagination: {
        currentPage: result.meta.page,
        pageSize: result.meta.limit,
        totalItems: result.meta.total,
        totalPages: result.meta.totalPages,
      },
      // Keep unreadCount accessible
      unreadCount: result.meta.unreadCount
    };

    return sendSuccess(
      res,
      response,
      "Get list notification successfully",
      StatusCodes.OK
    );
  }),

  markReadAll: catchAsync(async (req, res) => {
    await notificationService.markReadAll(req.user.userId);
    
    return sendSuccess(
      res,
      null,
      "Mark all notifications as read successfully",
      StatusCodes.OK
    );
  }),

  cleanNotification: catchAsync(async (req, res) => {
    await notificationService.cleanNotification(req.user.userId);
    
    return sendSuccess(
      res,
      null,
      "Clean all notifications successfully",
      StatusCodes.OK
    );
  }),

  countUnread: catchAsync(async (req, res) => {
    const count = await notificationService.countUnread(req.user.userId);
    
    return sendSuccess(
      res,
      { count },
      "Count unread notifications successfully",
      StatusCodes.OK
    );
  }),

  getNotificationById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const notification = await notificationService.getNotificationById(id, req.user.userId);
    return sendSuccess(
      res, 
      notification, 
      "Get notification details successfully",
      StatusCodes.OK
    );
  }),

  updateNotification: catchAsync(async (req, res) => {
    const { id } = req.params;


    const notification = await notificationService.updateNotification(id, req.user.userId, req.body);
    return sendSuccess(
      res, 
      notification, 
      "Update notification successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = notificationController;
