const amqp = require('amqp-connection-manager');
const logger = require('../utils/logger');

const rabbitClients = new Map();

let rabbitConnectionManager = null;
let rabbitConnectionPromise = null;

const HEARTBEAT_INTERVAL_IN_SECONDS =
  Number(process.env.RABBITMQ_HEARTBEAT_INTERVAL_IN_SECONDS) || 5;
const RECONNECT_TIME_IN_SECONDS = Number(process.env.RABBITMQ_RECONNECT_DELAY_MS || 5000) / 1000;
const CONNECT_TIMEOUT_MS = Number(process.env.RABBITMQ_CONNECT_TIMEOUT_MS) || 10000;

const config_rabbitMQ = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',

  exchange: {
    name: process.env.RABBITMQ_EXCHANGE || 'app.topic',
    type: 'topic',
    options: { durable: true },
  },

  deadLetterExchange: {
    name: process.env.RABBITMQ_DLX || 'app.topic.dlx',
    type: 'topic',
    options: { durable: true },
  },

  queues: {
    notification: {
      name: 'notification_queue',
      routingKey: 'notification.*',
      dlq: 'notification_queue_dlq',
      dlRoutingKey: 'notification.dlq',
      retryQueue: 'notification_queue_retry',
      retryRoutingKey: 'notification.retry',
      failedQueue: 'notification_queue_failed',
      retryDelayMs: Number(process.env.NOTIFICATION_RETRY_DELAY_MS) || 5000,
      maxRetries: Number(process.env.NOTIFICATION_MAX_RETRIES) || 3,
    },
    order: {
      name: 'order_queue',
      routingKey: 'order.*',
      dlq: 'order_queue_dlq',
      dlRoutingKey: 'order.dlq',
    },
  },
};

const getRabbitMQClientKey = (serviceName, confirm, clientName) =>
  `${serviceName}:${confirm ? 'confirm' : 'regular'}:${clientName}`;

const safeCloseRabbitMQResource = async (resource) => {
  if (!resource?.close) return;

  try {
    await resource.close();
  } catch (_error) {}
};

const bindRabbitMQConnectionLifecycle = (connectionManager) => {
  connectionManager.on('connect', ({ url }) => {
    logger.info('RabbitMQ connected', {
      url: typeof url === 'string' ? url : config_rabbitMQ.url,
    });
  });

  connectionManager.on('connectFailed', ({ err, url }) => {
    logger.error('RabbitMQ connection failed', {
      url: typeof url === 'string' ? url : config_rabbitMQ.url,
      error: err.message,
    });
  });

  connectionManager.on('disconnect', ({ err }) => {
    logger.warn('RabbitMQ disconnected', {
      error: err?.message,
    });
  });

  connectionManager.on('blocked', ({ reason }) => {
    logger.warn('RabbitMQ connection blocked', { reason });
  });

  connectionManager.on('unblocked', () => {
    logger.info('RabbitMQ connection unblocked');
  });
};

const bindRabbitMQChannelLifecycle = (serviceName, clientName, channel) => {
  channel.on('connect', () => {
    logger.info('RabbitMQ channel ready', {
      service: serviceName,
      client: clientName,
    });
  });

  channel.on('error', (error, info = {}) => {
    logger.error('RabbitMQ channel error', {
      service: serviceName,
      client: clientName,
      name: info.name,
      error: error.message,
    });
  });

  channel.on('close', () => {
    logger.warn('RabbitMQ channel closed', {
      service: serviceName,
      client: clientName,
    });
  });
};

const getRabbitMQConnectionManager = () => {
  if (rabbitConnectionManager) {
    return rabbitConnectionManager;
  }

  rabbitConnectionManager = amqp.connect([config_rabbitMQ.url], {
    heartbeatIntervalInSeconds: HEARTBEAT_INTERVAL_IN_SECONDS,
    reconnectTimeInSeconds: RECONNECT_TIME_IN_SECONDS || HEARTBEAT_INTERVAL_IN_SECONDS,
  });

  bindRabbitMQConnectionLifecycle(rabbitConnectionManager);

  return rabbitConnectionManager;
};

const ensureRabbitMQConnection = async () => {
  const connectionManager = getRabbitMQConnectionManager();

  if (!rabbitConnectionPromise) {
    rabbitConnectionPromise = connectionManager
      .connect({ timeout: CONNECT_TIMEOUT_MS })
      .catch((error) => {
        rabbitConnectionPromise = null;
        throw error;
      });
  }

  await rabbitConnectionPromise;
  return connectionManager;
};

async function setupQueueTopology(channel, serviceName) {
  const queue = config_rabbitMQ.queues[serviceName];
  if (!queue) throw new Error(`Queue for service ${serviceName} not defined in config`);

  await channel.assertExchange(
    config_rabbitMQ.exchange.name,
    config_rabbitMQ.exchange.type,
    config_rabbitMQ.exchange.options,
  );
  await channel.assertExchange(
    config_rabbitMQ.deadLetterExchange.name,
    config_rabbitMQ.deadLetterExchange.type,
    config_rabbitMQ.deadLetterExchange.options,
  );

  await channel.assertQueue(queue.name, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': config_rabbitMQ.deadLetterExchange.name,
      'x-dead-letter-routing-key': queue.dlRoutingKey,
    },
  });
  await channel.bindQueue(queue.name, config_rabbitMQ.exchange.name, queue.routingKey);

  await channel.assertQueue(queue.dlq, { durable: true });
  await channel.bindQueue(queue.dlq, config_rabbitMQ.deadLetterExchange.name, queue.dlRoutingKey);

  if (queue.retryQueue) {
    await channel.assertQueue(queue.retryQueue, {
      durable: true,
      arguments: {
        'x-message-ttl': queue.retryDelayMs,
        'x-dead-letter-exchange': config_rabbitMQ.exchange.name,
        'x-dead-letter-routing-key': queue.retryRoutingKey,
      },
    });
  }

  if (queue.failedQueue) {
    await channel.assertQueue(queue.failedQueue, { durable: true });
  }

  return queue;
}

async function connectRabbitMQ(serviceName, options = {}) {
  const { confirm = false, clientName = 'default' } = options;
  const clientKey = getRabbitMQClientKey(serviceName, confirm, clientName);
  const cachedClient = rabbitClients.get(clientKey);
  if (cachedClient) {
    return cachedClient;
  }

  const queue = config_rabbitMQ.queues[serviceName];
  if (!queue) throw new Error(`Queue for service ${serviceName} not defined in config`);

  const connection = await ensureRabbitMQConnection();
  const channel = connection.createChannel({
    name: clientKey,
    confirm,
    setup: async (currentChannel) => {
      await setupQueueTopology(currentChannel, serviceName);
    },
  });

  bindRabbitMQChannelLifecycle(serviceName, clientName, channel);

  const client = { connection, channel, queue };
  rabbitClients.set(clientKey, client);

  try {
    await channel.waitForConnect();
    return client;
  } catch (error) {
    rabbitClients.delete(clientKey);
    await safeCloseRabbitMQResource(channel);
    logger.error('Failed to prepare RabbitMQ channel', {
      service: serviceName,
      client: clientName,
      error: error.message,
    });
    throw error;
  }
}

async function closeRabbitMQConnections() {
  const clients = [...rabbitClients.values()];
  rabbitClients.clear();

  await Promise.allSettled(clients.map(({ channel }) => safeCloseRabbitMQResource(channel)));

  if (rabbitConnectionManager) {
    const currentConnectionManager = rabbitConnectionManager;
    rabbitConnectionManager = null;
    rabbitConnectionPromise = null;
    await safeCloseRabbitMQResource(currentConnectionManager);
  }
}

module.exports = {
  closeRabbitMQConnections,
  connectRabbitMQ,
  config_rabbitMQ,
  setupQueueTopology,
};
