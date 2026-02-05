
const express = require("express");

const router = express.Router();

const NotificationController = require("../controllers/notification.controller");

const { verifyAccessToken } = require("../middlewares/auth.middleware");

const validate = require("../middlewares/validate.middleware");

const notificationValidator = require("../validations/notification.validator");
// All notification routes require authentication

router.use(verifyAccessToken);

/**
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
 * @desc    Mark all notifications as read
 * @access  Private (Authenticated users)
 */
router.patch("/read-all", NotificationController.markReadAll);

/**
 * @desc    Delete all notifications for current user
 * @access  Private (Authenticated users)
 */
router.delete("/", NotificationController.cleanNotification);

/**
 * @desc    Get count of unread notifications
 * @access  Private (Authenticated users)
 */
router.get("/count", NotificationController.countUnread);

/**
 * @desc    Get notification by ID
 * @access  Private (Authenticated users)
 */
router.get("/:id", NotificationController.getNotificationById);

/**
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
