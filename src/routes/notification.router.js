const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const notificationValidator = require("../validations/notification.validator");

router.use(verifyAccessToken);

router.post(
  "/",
  validate(notificationValidator.createNotification),
  notificationController.createNotification
);
router.get(
  "/",
  validate({ query: notificationValidator.getListNotification }),
  notificationController.getListNotification
);
router.patch("/read-all", notificationController.markReadAll);
router.delete("/", notificationController.cleanNotification);
router.get("/count", notificationController.countUnread);
router.get("/:id", notificationController.getNotificationById);
router.patch(
  "/:id",
  validate(notificationValidator.updateNotification),
  notificationController.updateNotification
);

module.exports = router;

