const { publishToQueue } = require('../configs/rabbitMQ.config');

/**
 * Đọc số lần retry của message RabbitMQ từ header 'x-retry-count'.
 */
const getRetryCount = (data) => {
  const retryCount = Number(data.properties?.headers?.['x-retry-count'] || 0);
  return Number.isNaN(retryCount) ? 0 : retryCount;
};

/**
 * Đưa message về retry queue (kèm header x-retry-count).
 * Dùng chung cho order + notification để tránh lặp publishToQueue boilerplate.
 */
const publishToRetryQueue = ({
  serviceName,
  queueName,
  content,
  retryCount,
  clientName = 'retry-publisher',
}) =>
  publishToQueue({
    serviceName,
    clientName,
    queueName,
    content,
    headers: { 'x-retry-count': retryCount },
    bufferWarningMessage: `RabbitMQ queue buffer is full for retry queue ${queueName}`,
    confirmErrorMessage: `Failed to confirm retry message to ${queueName}`,
    successMessage: 'Message sent to retry queue',
    successMeta: { retryCount },
  });

/**
 * Đưa message đã vượt retry về failed queue (đánh dấu max_retries_exceeded).
 * Dùng chung cho order + notification.
 */
const publishToFailedQueue = ({
  serviceName,
  queueName,
  content,
  retryCount,
  clientName = 'failed-publisher',
}) =>
  publishToQueue({
    serviceName,
    clientName,
    queueName,
    content,
    headers: {
      'x-retry-count': retryCount,
      'x-final-failure-reason': 'max_retries_exceeded',
    },
    bufferWarningMessage: `RabbitMQ queue buffer is full for failed queue ${queueName}`,
    confirmErrorMessage: `Failed to confirm failed message to ${queueName}`,
    successMessage: 'Message moved to failed queue',
    successMeta: { retryCount },
  });

module.exports = { getRetryCount, publishToRetryQueue, publishToFailedQueue };
