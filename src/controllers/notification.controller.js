const notificationService = require("../services/notification.service");
const catchAsync = require("../configs/catchAsync");
const { formatResponse } = require("../shared/res/formatResponse");
const notificationValidator = require("../validations/notification.validator");

const notificationController = {
  createNotification: catchAsync(async (req, res) => {
    const { error } = notificationValidator.createNotification.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json(formatResponse(false, null, error.details[0].message));
    }
    const notification = await notificationService.createNotification({
      ...req.body,
      userId: req.user.id,
    });
    res
      .status(201)
      .json(
        formatResponse(true, notification, "Notification created successfully")
      );
  }),

  getListNotification: catchAsync(async (req, res) => {
    const { error } = notificationValidator.getListNotification.validate(
      req.query
    );
    if (error) {
      return res
        .status(400)
        .json(formatResponse(false, null, error.details[0].message));
    }
    const { page, limit } = req.query;
    const result = await notificationService.getListNotification(req.user.id, {
      page,
      limit,
    });
    res
      .status(200)
      .json(formatResponse(true, result, "Get list notification successfully"));
  }),

  markReadAll: catchAsync(async (req, res) => {
    await notificationService.markReadAll(req.user.id);
    res
      .status(200)
      .json(
        formatResponse(true, null, "Mark all notifications as read successfully")
      );
  }),

  cleanNotification: catchAsync(async (req, res) => {
    await notificationService.cleanNotification(req.user.id);
    res
      .status(200)
      .json(formatResponse(true, null, "Clean all notifications successfully"));
  }),

  countUnread: catchAsync(async (req, res) => {
    const count = await notificationService.countUnread(req.user.id);
    res
      .status(200)
      .json(
        formatResponse(true, { count }, "Count unread notifications successfully")
      );
  }),
};

module.exports = notificationController;
