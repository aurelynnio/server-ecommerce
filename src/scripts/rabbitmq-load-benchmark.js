const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

const amqp = require('amqplib');

const config = {
  rabbitUrl: process.env.BENCH_RABBITMQ_URL || 'amqp://app:app@127.0.0.1:5673',
  totalMessages: Number(process.env.BENCH_RABBITMQ_MESSAGES) || 10000,
  publisherChannels: Number(process.env.BENCH_RABBITMQ_PUBLISHERS) || 8,
  consumerChannels: Number(process.env.BENCH_RABBITMQ_CONSUMERS) || 4,
  publishWindow: Number(process.env.BENCH_RABBITMQ_PUBLISH_WINDOW) || 500,
  prefetch: Number(process.env.BENCH_RABBITMQ_PREFETCH) || 500,
  consumerWorkMs: Number(process.env.BENCH_RABBITMQ_CONSUMER_WORK_MS) || 0,
  drainTimeoutMs: Number(process.env.BENCH_RABBITMQ_DRAIN_TIMEOUT_MS) || 60000,
  messageBytes: Number(process.env.BENCH_RABBITMQ_MESSAGE_BYTES) || 512,
};

const round = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const timeoutAfter = (ms, value) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(value), ms);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
};

const summarize = (values) => {
  if (values.length === 0) {
    return {
      count: 0,
      avgMs: 0,
      minMs: 0,
      p50Ms: 0,
      p97_5Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    };
  }

  let total = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    total += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return {
    count: values.length,
    avgMs: round(total / values.length),
    minMs: round(min),
    p50Ms: round(percentile(values, 50)),
    p97_5Ms: round(percentile(values, 97.5)),
    p99Ms: round(percentile(values, 99)),
    maxMs: round(max),
  };
};

const makePadding = () => {
  const basePayloadBytes = 120;
  return 'x'.repeat(Math.max(0, config.messageBytes - basePayloadBytes));
};

async function setupTopology(connection) {
  const channel = await connection.createChannel();
  const exchange = `cv.benchmark.topic.${Date.now()}`;
  const routingKey = 'notification.created';
  const queueName = `cv.benchmark.queue.${Date.now()}`;

  await channel.assertExchange(exchange, 'topic', {
    durable: false,
    autoDelete: true,
  });

  const queue = await channel.assertQueue(queueName, {
    durable: false,
    autoDelete: true,
    exclusive: true,
  });

  await channel.bindQueue(queue.queue, exchange, routingKey);
  await channel.close();

  return {
    exchange,
    routingKey,
    queueName: queue.queue,
  };
}

function createDrainPromise(totalMessages, latencies) {
  let received = 0;
  let resolveDrain;
  const drainPromise = new Promise((resolve) => {
    resolveDrain = resolve;
  });

  const record = (sentAt) => {
    received++;
    latencies.push(performance.now() - sentAt);
    if (received >= totalMessages) {
      resolveDrain({ received });
    }
  };

  return {
    drainPromise,
    getReceived: () => received,
    record,
  };
}

async function startConsumers(connection, topology, drainTracker) {
  const channels = [];

  for (let i = 0; i < config.consumerChannels; i++) {
    const channel = await connection.createChannel();
    await channel.prefetch(config.prefetch);

    await channel.consume(
      topology.queueName,
      async (message) => {
        if (!message) return;

        try {
          const payload = JSON.parse(message.content.toString());
          if (config.consumerWorkMs > 0) {
            await sleep(config.consumerWorkMs);
          }
          drainTracker.record(payload.sentAt);
          channel.ack(message);
        } catch (_error) {
          channel.nack(message, false, false);
        }
      },
      { noAck: false },
    );

    channels.push(channel);
  }

  return channels;
}

function publishMessages(channel, topology, publisherId, messagesForPublisher) {
  const padding = makePadding();
  let next = 0;
  let inFlight = 0;
  let confirmed = 0;
  let failed = 0;
  let waitingForDrain = false;

  return new Promise((resolve, reject) => {
    const maybeDone = () => {
      if (confirmed + failed >= messagesForPublisher) {
        if (failed > 0) {
          reject(new Error(`Publisher ${publisherId} failed to confirm ${failed} messages`));
          return;
        }
        resolve({ confirmed });
      }
    };

    const pump = () => {
      waitingForDrain = false;

      while (next < messagesForPublisher && inFlight < config.publishWindow) {
        const payload = {
          sentAt: performance.now(),
          publisherId,
          sequence: next,
          padding,
        };

        const buffer = Buffer.from(JSON.stringify(payload));
        inFlight++;
        next++;

        const canContinue = channel.publish(
          topology.exchange,
          topology.routingKey,
          buffer,
          {
            persistent: false,
            contentType: 'application/json',
          },
          (error) => {
            inFlight--;
            if (error) {
              failed++;
            } else {
              confirmed++;
            }
            maybeDone();
            if (!waitingForDrain) {
              pump();
            }
          },
        );

        if (!canContinue) {
          waitingForDrain = true;
          channel.once('drain', pump);
          break;
        }
      }

      maybeDone();
    };

    pump();
  });
}

async function runBenchmark() {
  const connection = await amqp.connect(config.rabbitUrl, {
    timeout: 5000,
  });

  const topology = await setupTopology(connection);
  const latencies = [];
  const drainTracker = createDrainPromise(config.totalMessages, latencies);
  const consumerChannels = await startConsumers(connection, topology, drainTracker);

  const publisherChannels = [];
  for (let i = 0; i < config.publisherChannels; i++) {
    publisherChannels.push(await connection.createConfirmChannel());
  }

  const perPublisherBase = Math.floor(config.totalMessages / config.publisherChannels);
  const extra = config.totalMessages % config.publisherChannels;

  const publishStart = performance.now();
  const publishResults = await Promise.all(
    publisherChannels.map((channel, index) => {
      const messageCount = perPublisherBase + (index < extra ? 1 : 0);
      return publishMessages(channel, topology, index, messageCount);
    }),
  );
  const publishEnd = performance.now();

  const drainStart = publishStart;
  const drainResult = await Promise.race([
    drainTracker.drainPromise,
    timeoutAfter(config.drainTimeoutMs, {
      received: drainTracker.getReceived(),
      timedOut: true,
    }),
  ]);
  const drainEnd = performance.now();

  for (const channel of publisherChannels) {
    await channel.close();
  }
  for (const channel of consumerChannels) {
    await channel.close();
  }
  await connection.close();

  const confirmedMessages = publishResults.reduce((sum, item) => sum + item.confirmed, 0);
  const publishDurationMs = publishEnd - publishStart;
  const drainDurationMs = drainEnd - drainStart;

  return {
    topology,
    confirmedMessages,
    receivedMessages: drainResult.received,
    timedOut: !!drainResult.timedOut,
    publishDurationMs: round(publishDurationMs),
    drainDurationMs: round(drainDurationMs),
    publishThroughputMsgPerSec: round(confirmedMessages / (publishDurationMs / 1000)),
    endToEndThroughputMsgPerSec: round(drainResult.received / (drainDurationMs / 1000)),
    latency: summarize(latencies),
  };
}

function buildMarkdown(report) {
  const result = report.result;
  const lines = [
    '# RabbitMQ Load Benchmark Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Machine: ${report.environment.platform} ${report.environment.arch}, ${report.environment.cpus} CPUs, Node ${report.environment.node}`,
    '',
    '## Configuration',
    '',
    `- Total messages: ${report.config.totalMessages}`,
    `- Publisher channels: ${report.config.publisherChannels}`,
    `- Consumer channels: ${report.config.consumerChannels}`,
    `- Publish window per channel: ${report.config.publishWindow}`,
    `- Consumer prefetch: ${report.config.prefetch}`,
    `- Message size target: ${report.config.messageBytes} bytes`,
    `- Simulated consumer work: ${report.config.consumerWorkMs}ms`,
    '',
    '## Results',
    '',
    `- Confirmed publishes: ${result.confirmedMessages}`,
    `- Consumed messages: ${result.receivedMessages}`,
    `- Publish duration: ${result.publishDurationMs}ms`,
    `- End-to-end drain duration: ${result.drainDurationMs}ms`,
    `- Publish throughput: ${result.publishThroughputMsgPerSec} msg/s`,
    `- End-to-end throughput: ${result.endToEndThroughputMsgPerSec} msg/s`,
    `- End-to-end latency avg: ${result.latency.avgMs}ms`,
    `- End-to-end latency p50: ${result.latency.p50Ms}ms`,
    `- End-to-end latency p97.5: ${result.latency.p97_5Ms}ms`,
    `- End-to-end latency p99: ${result.latency.p99Ms}ms`,
    `- Timed out: ${result.timedOut ? 'yes' : 'no'}`,
    '',
    '## Notes',
    '',
    '- This benchmark uses RabbitMQ topic exchange routing with broker confirm channels.',
    '- It measures broker publish/consume throughput and end-to-end queue latency, not the full business logic inside order/notification workers.',
    '- Local results depend on Docker, CPU, disk, Windows networking and current machine load.',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      hostname: os.hostname(),
    },
    config,
    result: await runBenchmark(),
  };

  const outputDir = path.join(process.cwd(), 'benchmark-results');
  await fs.mkdir(outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `rabbitmq-load-benchmark-${stamp}.json`);
  const mdPath = path.join(outputDir, `rabbitmq-load-benchmark-${stamp}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, buildMarkdown(report), 'utf8');

  console.log('');
  console.log(buildMarkdown(report));
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);
}

main().catch((error) => {
  console.error('[ERROR] RabbitMQ benchmark failed:', error);
  process.exitCode = 1;
});
