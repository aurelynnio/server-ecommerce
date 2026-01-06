const { consumeFromQueue } = require("../utils/rabbitmq.util");
const notificationService = require("../services/notification.service");

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

      console.log(`Notification of type ${type} processed for user ${userId}`);
    } catch (error) {
      console.error("Failed to process notification:", error);
      throw error;
    }
  });
};

module.exports = {
  initNotificationWorker,
};
