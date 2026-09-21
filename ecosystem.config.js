/**
 * PM2 ecosystem — kiến trúc tách worker process.
 *
 *   pm2 start ecosystem.config.js
 *
 * - api: chỉ HTTP API + publish (không consume queue) → START_QUEUE_WORKERS=false
 * - order-worker: node src/workers/order.worker.js (command + event + DLQ riêng)
 * - notification-worker: node src/workers/notification.worker.js
 *
 * Lưu ý:
 * - Nếu chạy PHIÊN BẢN cũ (worker trong process API), bỏ START_QUEUE_WORKERS=false
 *   hoặc set 'true'.
 * - Không khởi động nhiều instance cho order-worker trên CÙNG 1 queue trừ khi bạn
 *   đã tách shard theo user (cùng user → cùng worker) để tránh WriteConflict.
 */
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        START_QUEUE_WORKERS: 'false',
      },
    },
    {
      name: 'order-worker',
      script: 'src/workers/order.worker.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        ORDER_WORKER_PREFETCH: '50',
        ORDER_DLQ_PREFETCH: '10',
        ORDER_PROCESSING_TIMEOUT_MS: '30000',
      },
    },
    {
      name: 'notification-worker',
      script: 'src/workers/notification.worker.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        NOTIFICATION_WORKER_PREFETCH: '50',
        NOTIFICATION_DLQ_PREFETCH: '10',
      },
    },
  ],
};
