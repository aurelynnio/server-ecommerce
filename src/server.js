process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '64';
require('dotenv').config();
const { server } = require('./app');
const connectDB = require('./db/connect.db');
const cluster = require('cluster');
const mongoose = require('mongoose');
const { initSocket, shutdownSocket } = require('./socket');
const logger = require('./utils/logger');
const { startQueueWorkers } = require('./workers');
const { closeRabbitMQConnections } = require('./configs/rabbitMQ.config');
const schedulerService = require('./services/scheduler.service');

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10 * 1000;
// Mặc định vẫn start worker trong process API (tương thích cũ).
// Khi deploy theo kiến trúc tách worker process (PM2 ecosystem), set 'false'
// để API chỉ publish, worker chạy riêng: node src/workers/order.worker.js
const startQueueWorkersEnabled = process.env.START_QUEUE_WORKERS !== 'false';

const redis = require('./configs/redis.config');

// Force round-robin connection balancing across cluster workers
// On Windows, Node.js defaults to SCHED_NONE (OS-delegated), which starves workers
// and dumps all connections on 1-2 workers. SCHED_RR balances load equally.
if (cluster.schedulingPolicy !== undefined) {
  cluster.schedulingPolicy = cluster.SCHED_RR;
}

const clusterEnabled =
  (process.env.NODE_ENV === 'production' || process.env.ENABLE_CLUSTER === 'true') &&
  process.env.ENABLE_CLUSTER !== 'false';
const configuredWorkers = Number(process.env.WEB_CONCURRENCY);
const workerCount =
  Number.isInteger(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : require('os').cpus().length;

const startServer = async () => {
  try {
    await connectDB();
    logger.info('Database connected successfully');

    const isFirstWorkerOrSingle = !cluster.isWorker || cluster.worker?.id === 1;

    // Fire-and-forget: không block server start khi RabbitMQ/Redis chưa sẵn sàng.
    // In cluster mode, only run queue workers on worker 1 to avoid running 12 duplicate worker sets
    // and exhausting RabbitMQ heartbeat/channels.
    if (startQueueWorkersEnabled && isFirstWorkerOrSingle) {
      startQueueWorkers()
        .then(() => logger.info('Queue workers started successfully'))
        .catch((workerError) => {
          logger.warn('Queue workers failed to start (non-critical):', {
            error: workerError.message,
          });
        });
    } else if (!isFirstWorkerOrSingle) {
      logger.info(`Queue workers skipped on worker ${cluster.worker?.id} (handled by worker 1)`);
    } else {
      logger.info('Queue workers disabled in API process (START_QUEUE_WORKERS=false)');
    }

    // Start background jobs (order auto-cancellation, outbox dispatch)
    // In cluster mode, only run on worker 1 to avoid running duplicate cron instances
    if (process.env.ENABLE_SCHEDULER !== 'false' && isFirstWorkerOrSingle) {
      schedulerService.startScheduler();
    }

    // Listen with a 4096 backlog queue to prevent TCP SYN packet drop on high-concurrency bursts
    server.listen(PORT, 4096, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  schedulerService.stopScheduler();

  const forceTimer = setTimeout(() => {
    logger.error('Force shutdown due to timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    await new Promise((resolve) => server.close(resolve));
  } catch (error) {
    logger.error('Error closing HTTP server:', { error: error.message });
  }

  await shutdownSocket();

  await Promise.allSettled([
    closeRabbitMQConnections(),
    mongoose.connection.close(false),
    redis.quit?.(),
  ]);

  clearTimeout(forceTimer);
  process.exit(0);
};

const setupProcessHandlers = () => {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', { reason });
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
    });
    shutdown('uncaughtException');
  });
};

if (cluster.isPrimary && clusterEnabled) {
  logger.info(
    `Primary ${process.pid} is running in production mode. Forking ${workerCount} workers...`,
  );

  const client = require('prom-client');
  const aggregatorRegistry = new client.AggregatorRegistry();

  // Listen for metric aggregation requests from workers
  cluster.on('message', async (worker, message) => {
    if (message && message.type === 'GET_CLUSTER_METRICS') {
      try {
        const aggregatedMetrics = await aggregatorRegistry.clusterMetrics();
        worker.send({
          type: 'CLUSTER_METRICS_RESPONSE',
          requestId: message.requestId,
          metrics: aggregatedMetrics,
          contentType: aggregatorRegistry.contentType,
        });
      } catch (err) {
        worker.send({
          type: 'CLUSTER_METRICS_RESPONSE',
          requestId: message.requestId,
          error: err.message,
        });
      }
    }
  });

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, _code, _signal) => {
    logger.warn(`Worker ${worker.process.pid} died. Forking a new worker...`);
    cluster.fork();
  });

  process.on('SIGTERM', () => {
    logger.info('Primary received SIGTERM. Shutting down workers...');
    cluster.disconnect(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    logger.info('Primary received SIGINT. Shutting down workers...');
    cluster.disconnect(() => process.exit(0));
  });
} else {
  if (cluster.isPrimary) {
    logger.info(`Server starting in ${process.env.NODE_ENV} mode...`);
  }
  initSocket(server);
  setupProcessHandlers();
  startServer();
}
