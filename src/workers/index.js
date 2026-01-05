const { initNotificationWorker } = require("./notification.worker");

const initWorkers = async () => {
  try {
    await initNotificationWorker();
    console.log("All workers initialized successfully");
  } catch (error) {
    console.error("Failed to initialize workers:", error);
  }
};

module.exports = {
  initWorkers,
};
