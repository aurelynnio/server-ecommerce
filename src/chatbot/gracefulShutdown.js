/**
 * Graceful shutdown handler - tách từ chatbot.controller.js
 *
 * Khi server nhận SIGTERM/SIGINT, đánh dấu `isShuttingDown = true`
 * để từ chối các request mới (stream LLM tốn thời gian).
 *
 * Dùng SHUTDOWN_GRACE_MS để cho phép các request đang chạy hoàn tất.
 */

const logger = require('../utils/logger');

const SHUTDOWN_GRACE_MS = Number(process.env.CHATBOT_SHUTDOWN_GRACE_MS) || 15_000;

let isShuttingDown = false;

process.once('SIGTERM', () => {
  logger.warn('[GracefulShutdown] SIGTERM received, marking shutting down');
  isShuttingDown = true;
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
});

process.once('SIGINT', () => {
  logger.warn('[GracefulShutdown] SIGINT received, marking shutting down');
  isShuttingDown = true;
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
});

module.exports = {
  get isShuttingDown() {
    return isShuttingDown;
  },
  SHUTDOWN_GRACE_MS,
};