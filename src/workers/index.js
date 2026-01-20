const { initNotificationWorker } = require("./notification.worker");
const logger = require("../utils/logger");

const initWorkers = async () => {
  try {
    await initNotificationWorker();
    logger.info("All workers initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize workers:", error);
  }
};

module.exports = {
  initWorkers,
};
