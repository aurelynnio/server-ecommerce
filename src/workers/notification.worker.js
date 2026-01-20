const { consumeFromQueue } = require("../utils/rabbitmq.util");
const notificationService = require("../services/notification.service");
const logger = require("../utils/logger");

const initNotificationWorker = async () => {
  await consumeFromQueue("notifications", async (data) => {
    const { type, userId, title, message, orderId, link } = data;

    try {
      await notificationService.createNotification({
        userId,
        type,
        title,
        message,
        orderId,
        link,
      });

      logger.info(`Notification of type ${type} processed for user ${userId}`);
    } catch (error) {
      logger.error("Failed to process notification:", error);
      throw error;
    }
  });
};

module.exports = {
  initNotificationWorker,
};
