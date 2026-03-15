const rabbitMQ = require('amqplib');
const logger = require('../utils/logger');

const rabbitClients = new Map();

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
      // define dead-letter queue for messages that fail processing
      dlq: 'notification_queue_dlq',
      dlRoutingKey: 'notification.dlq',
      // define retry queue
      retryQueue: 'notification_queue_retry',
      retryRoutingKey: 'notification.retry',
      // define failed queue for messages that exceed max retries
      failedQueue: 'notification_queue_failed',
      retryDelayMs: Number(process.env.NOTIFICATION_RETRY_DELAY_MS) || 5000,
      maxRetries: Number(process.env.NOTIFICATION_MAX_RETRIES) || 3,
    },
    payment: {
      name: 'payment_queue',
      routingKey: 'payment.*',
      dlq: 'payment_queue_dlq',
      dlRoutingKey: 'payment.dlq',
    },
    order: {
      name: 'order_queue',
      routingKey: 'order.*',
      dlq: 'order_queue_dlq',
      dlRoutingKey: 'order.dlq',
    },
    inventory: {
      name: 'inventory_queue',
      routingKey: 'inventory.*',
      dlq: 'inventory_queue_dlq',
      dlRoutingKey: 'inventory.dlq',
    },
  },
};

const getRabbitMQClientKey = (serviceName, confirm, clientName) =>
  `${serviceName}:${confirm ? 'confirm' : 'regular'}:${clientName}`;

const clearRabbitMQClient = (clientKey, connection) => {
  const cachedClient = rabbitClients.get(clientKey);
  if (!cachedClient) return;
  if (connection && cachedClient.connection !== connection) return;
  rabbitClients.delete(clientKey);
};

const safeCloseRabbitMQResource = async (resource) => {
  if (!resource?.close) return;

  try {
    await resource.close();
  } catch (_error) {}
};

const bindRabbitMQLifecycle = (clientKey, serviceName, clientName, connection, channel) => {
  const clearClient = () => clearRabbitMQClient(clientKey, connection);

  connection.on('error', (error) => {
    logger.error('RabbitMQ connection error', {
      service: serviceName,
      client: clientName,
      error: error.message,
    });
    clearClient();
  });

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed', {
      service: serviceName,
      client: clientName,
    });
    clearClient();
  });

  channel.on('error', (error) => {
    logger.error('RabbitMQ channel error', {
      service: serviceName,
      client: clientName,
      error: error.message,
    });
    clearClient();
  });

  channel.on('close', () => {
    logger.warn('RabbitMQ channel closed', {
      service: serviceName,
      client: clientName,
    });
    clearClient();
  });
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

  let connection;
  let channel;

  try {
    const queue = config_rabbitMQ.queues[serviceName];
    if (!queue) throw new Error(`Queue for service ${serviceName} not defined in config`);
    connection = await rabbitMQ.connect(config_rabbitMQ.url);
    channel = confirm ? await connection.createConfirmChannel() : await connection.createChannel();
    await setupQueueTopology(channel, serviceName);
    bindRabbitMQLifecycle(clientKey, serviceName, clientName, connection, channel);

    const client = { connection, channel, queue };
    rabbitClients.set(clientKey, client);
    logger.info('Connected to RabbitMQ and configured queue topology', {
      service: serviceName,
      client: clientName,
      queue: queue.name,
    });
    return client;
  } catch (error) {
    clearRabbitMQClient(clientKey, connection);
    await safeCloseRabbitMQResource(channel);
    await safeCloseRabbitMQResource(connection);
    logger.error('Failed to connect to RabbitMQ', error);
    throw error;
  }
}

async function closeRabbitMQConnections() {
  const clients = [...rabbitClients.values()];
  rabbitClients.clear();

  await Promise.allSettled(
    clients.flatMap(({ channel, connection }) => [
      safeCloseRabbitMQResource(channel),
      safeCloseRabbitMQResource(connection),
    ]),
  );
}

module.exports = {
  closeRabbitMQConnections,
  connectRabbitMQ,
  config_rabbitMQ,
  setupQueueTopology,
};
