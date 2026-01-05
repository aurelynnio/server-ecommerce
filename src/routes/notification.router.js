const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/notification.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const notificationValidator = require("../validations/notification.validator");

// All notification routes require authentication
router.use(verifyAccessToken);

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private (Authenticated users)
 * @body    { title, message, type?, link?, orderId? }
 */
router.post(
  "/",
  validate(notificationValidator.createNotification),
  NotificationController.createNotification
);

/**
 * @route   GET /api/notifications
 * @desc    Get list of notifications for current user
 * @access  Private (Authenticated users)
 * @query   page, limit
 */
router.get(
  "/",
  validate({ query: notificationValidator.getListNotification }),
  NotificationController.getListNotification
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Authenticated users)
 */
router.patch("/read-all", NotificationController.markReadAll);

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications for current user
 * @access  Private (Authenticated users)
 */
router.delete("/", NotificationController.cleanNotification);

/**
 * @route   GET /api/notifications/count
 * @desc    Get count of unread notifications
 * @access  Private (Authenticated users)
 */
router.get("/count", NotificationController.countUnread);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private (Authenticated users)
 */
router.get("/:id", NotificationController.getNotificationById);

/**
 * @route   PATCH /api/notifications/:id
 * @desc    Update notification (e.g., mark as read)
 * @access  Private (Authenticated users)
 * @body    { isRead?, title?, message? }
 */
router.patch(
  "/:id",
  validate(notificationValidator.updateNotification),
  NotificationController.updateNotification
);

module.exports = router;
