const consumerNotificationQueue = require('./notification.worker');
const logger = require('../utils/logger');

let workersStarted = false;

const startQueueWorkers = async () => {
  if (workersStarted) {
    return;
  }

  workersStarted = true;

  const results = await Promise.allSettled([consumerNotificationQueue()]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error('Queue worker failed to start', {
        worker: ['notification'][index],
        error: result.reason?.message || String(result.reason),
      });
    }
  });

  const failedWorkers = results
    .map((result, index) => (result.status === 'rejected' ? ['notification'][index] : null))
    .filter(Boolean);

  if (failedWorkers.length > 0) {
    workersStarted = false;
    throw new Error(`Failed to start queue workers: ${failedWorkers.join(', ')}`);
  }
};

module.exports = {
  startQueueWorkers,
};
