const { consumeFromQueue } = require("../utils/rabbitmq.util");
const notificationService = require("../services/notification.service");

const initNotificationWorker = async () => {
  console.log("Notification Worker initialized");

  await consumeFromQueue("notifications", async (data) => {
    console.log("Processing notification:", data);

    const { type, userId, title, message, orderId, link } = data;

    try {
      // Use NotificationService to create and emit notification
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
