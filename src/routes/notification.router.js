const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller")
const { verifyAccessToken } = require("../middlewares/auth.middleware");

router.use(verifyAccessToken);

router.post("/", notificationController.createNotification);
router.get("/", notificationController.getListNotification);
router.patch("/read-all", notificationController.markReadAll);
router.delete("/", notificationController.cleanNotification);
router.get("/count", notificationController.countUnread);
router.get("/:id", notificationController.getNotificationById);
router.patch("/:id", notificationController.updateNotification);

module.exports = router;
