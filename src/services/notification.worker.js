const { consumeFromQueue } = require("../utils/rabbitmq.util");
// Assuming there's a notification service to actually send emails/messages
// const notificationService = require('./notification.service');

const initNotificationWorker = async () => {
  console.log("Notification Worker initialized");

  await consumeFromQueue("notifications", async (data) => {
    console.log("Processing notification:", data);

    const { type, userId, message } = data;

    try {
      // Logic to send notification (e.g., Email, SMS, Push)
      // await notificationService.send(userId, type, message);

      console.log(`Notification of type ${type} sent to user ${userId}`);
    } catch (error) {
      console.error("Failed to process notification:", error);
      throw error; // Re-throw to trigger nack/requeue if configured
    }
  });
};

module.exports = {
  initNotificationWorker,
};
