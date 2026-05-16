const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

const Redis = require('ioredis');
const amqp = require('amqplib');

const config = {
  uploadFiles: Number(process.env.BENCH_UPLOAD_FILES) || 10,
  uploadDelayMs: Number(process.env.BENCH_UPLOAD_DELAY_MS) || 120,
  uploadIterations: Number(process.env.BENCH_UPLOAD_ITERATIONS) || 12,
  redisUrl: process.env.BENCH_REDIS_URL || 'redis://127.0.0.1:6380',
  redisIterations: Number(process.env.BENCH_REDIS_ITERATIONS) || 5000,
  httpDurationMs: Number(process.env.BENCH_HTTP_DURATION_MS) || 5000,
  httpConcurrency: Number(process.env.BENCH_HTTP_CONCURRENCY) || 200,
  rabbitUrl: process.env.BENCH_RABBITMQ_URL || 'amqp://app:app@127.0.0.1:5673',
  queueMessages: Number(process.env.BENCH_QUEUE_MESSAGES) || 300,
  syncJobDelayMs: Number(process.env.BENCH_SYNC_JOB_DELAY_MS) || 50,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const round = (value, digits = 2) => Number(value.toFixed(digits));

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
};

const summarize = (values) => {
  if (values.length === 0) {
    return { count: 0, avgMs: 0, minMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    avgMs: round(total / values.length),
    minMs: round(Math.min(...values)),
    p50Ms: round(percentile(values, 50)),
    p95Ms: round(percentile(values, 95)),
    p99Ms: round(percentile(values, 99)),
    maxMs: round(Math.max(...values)),
  };
};

const percentageReduction = (baseline, optimized) => {
  if (!baseline) return 0;
  return round(((baseline - optimized) / baseline) * 100);
};

const measure = async (fn) => {
  const start = performance.now();
  await fn();
  return performance.now() - start;
};

const buildProductPayload = () => ({
  products: Array.from({ length: 48 }, (_, index) => ({
    _id: `product-${index}`,
    name: `Benchmark product ${index}`,
    slug: `benchmark-product-${index}`,
    brand: index % 2 === 0 ? 'Brand A' : 'Brand B',
    category: index % 3 === 0 ? 'Shoes' : 'Apparel',
    price: {
      currentPrice: 100000 + index * 2500,
      discountPrice: index % 5 === 0 ? 90000 + index * 1500 : null,
    },
    variants: [
      {
        color: 'Black',
        size: 'M',
        stock: 20 + index,
        images: [`https://cdn.example.com/products/${index}.jpg`],
      },
    ],
    ratingAverage: 4 + (index % 10) / 10,
    soldCount: 100 + index * 3,
  })),
  pagination: {
    page: 1,
    limit: 48,
    total: 480,
    totalPages: 10,
  },
});

async function benchmarkParallelUploads() {
  const uploadOne = async () => {
    await sleep(config.uploadDelayMs);
    return { secure_url: 'https://cdn.example.com/image.jpg' };
  };

  const runSequential = () =>
    Array.from({ length: config.uploadFiles }).reduce(
      (chain) => chain.then(() => uploadOne()),
      Promise.resolve(),
    );

  const runParallel = () =>
    Promise.all(Array.from({ length: config.uploadFiles }, () => uploadOne()));

  await runSequential();
  await runParallel();

  const sequential = [];
  const parallel = [];

  for (let i = 0; i < config.uploadIterations; i++) {
    sequential.push(await measure(runSequential));
    parallel.push(await measure(runParallel));
  }

  const sequentialSummary = summarize(sequential);
  const parallelSummary = summarize(parallel);

  return {
    status: 'completed',
    notes:
      'Controlled benchmark with simulated IO-bound Cloudinary upload latency. It validates the Promise.all strategy, not external Cloudinary network performance.',
    input: {
      files: config.uploadFiles,
      simulatedUploadDelayMs: config.uploadDelayMs,
      iterations: config.uploadIterations,
    },
    sequential: sequentialSummary,
    parallel: parallelSummary,
    avgReductionPercent: percentageReduction(sequentialSummary.avgMs, parallelSummary.avgMs),
    p95ReductionPercent: percentageReduction(sequentialSummary.p95Ms, parallelSummary.p95Ms),
  };
}

async function connectRedis() {
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });

  await redis.connect();
  await redis.ping();
  return redis;
}

async function benchmarkRedisCache() {
  let redis;
  try {
    redis = await connectRedis();
  } catch (error) {
    return {
      status: 'skipped',
      reason: `Redis unavailable at ${config.redisUrl}: ${error.message}`,
    };
  }

  const cacheKey = 'cv-benchmark:products';
  const payload = buildProductPayload();
  await redis.set(cacheKey, JSON.stringify(payload), 'EX', 300);

  const latencies = [];
  for (let i = 0; i < config.redisIterations; i++) {
    latencies.push(
      await measure(async () => {
        const raw = await redis.get(cacheKey);
        JSON.parse(raw);
      }),
    );
  }

  await redis.del(cacheKey);
  await redis.quit();

  const summary = summarize(latencies);
  return {
    status: 'completed',
    redisUrl: config.redisUrl,
    iterations: config.redisIterations,
    payloadBytes: Buffer.byteLength(JSON.stringify(payload)),
    cacheHitLatency: summary,
    p95Under10ms: summary.p95Ms < 10,
  };
}

const requestOnce = (url, agent) =>
  new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.get(url, { agent }, (res) => {
      res.resume();
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          durationMs: performance.now() - start,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('request timeout'));
    });
  });

async function benchmarkCachedHttpEndpoint() {
  let redis;
  try {
    redis = await connectRedis();
  } catch (error) {
    return {
      status: 'skipped',
      reason: `Redis unavailable at ${config.redisUrl}: ${error.message}`,
    };
  }

  const cacheKey = 'cv-benchmark:http-products';
  const payload = buildProductPayload();
  await redis.set(cacheKey, JSON.stringify(payload), 'EX', 300);

  const server = http.createServer(async (_req, res) => {
    try {
      const raw = await redis.get(cacheKey);
      if (!raw) {
        res.statusCode = 404;
        res.end('missing cache');
        return;
      }

      const parsed = JSON.parse(raw);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(parsed));
    } catch (error) {
      res.statusCode = 500;
      res.end(error.message);
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/cached-products`;
  const agent = new http.Agent({
    keepAlive: true,
    maxSockets: config.httpConcurrency,
  });

  const latencies = [];
  let completed = 0;
  let failed = 0;
  const start = performance.now();
  const stopAt = start + config.httpDurationMs;

  const worker = async () => {
    while (performance.now() < stopAt) {
      try {
        const result = await requestOnce(url, agent);
        if (result.statusCode === 200) {
          completed++;
          latencies.push(result.durationMs);
        } else {
          failed++;
        }
      } catch (_error) {
        failed++;
      }
    }
  };

  await Promise.all(Array.from({ length: config.httpConcurrency }, () => worker()));
  const elapsedMs = performance.now() - start;

  agent.destroy();
  await new Promise((resolve) => server.close(resolve));
  await redis.del(cacheKey);
  await redis.quit();

  const summary = summarize(latencies);
  return {
    status: 'completed',
    notes:
      'Local cached product-discovery-style HTTP benchmark backed by Redis. This is a cache-path benchmark, not a full database-backed API benchmark.',
    redisUrl: config.redisUrl,
    durationMs: round(elapsedMs),
    concurrency: config.httpConcurrency,
    completedRequests: completed,
    failedRequests: failed,
    rps: round(completed / (elapsedMs / 1000)),
    latency: summary,
    p95Under10ms: summary.p95Ms < 10,
  };
}

async function publishWithConfirm(channel, queueName, payload) {
  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(payload)),
      { persistent: false, contentType: 'application/json' },
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
}

async function benchmarkRabbitMQDecoupling() {
  let connection;
  try {
    connection = await amqp.connect(config.rabbitUrl, { timeout: 5000 });
  } catch (error) {
    return {
      status: 'skipped',
      reason: `RabbitMQ unavailable at ${config.rabbitUrl}: ${error.message}`,
    };
  }

  const channel = await connection.createConfirmChannel();
  const queueName = 'cv_benchmark_queue';
  await channel.assertQueue(queueName, { durable: false, autoDelete: true });
  await channel.purgeQueue(queueName);

  const syncLatencies = [];
  const publishLatencies = [];

  for (let i = 0; i < Math.min(config.queueMessages, 30); i++) {
    syncLatencies.push(await measure(() => sleep(config.syncJobDelayMs)));
  }

  for (let i = 0; i < config.queueMessages; i++) {
    publishLatencies.push(
      await measure(() =>
        publishWithConfirm(channel, queueName, {
          eventName: 'notification.created',
          userId: `user-${i}`,
          title: 'Benchmark',
          message: 'Queued message',
        }),
      ),
    );
  }

  await channel.purgeQueue(queueName);
  await channel.close();
  await connection.close();

  const syncSummary = summarize(syncLatencies);
  const publishSummary = summarize(publishLatencies);

  return {
    status: 'completed',
    rabbitUrl: config.rabbitUrl,
    notes:
      'Compares a request waiting for a simulated downstream job with a request that only enqueues the job with broker confirm.',
    messages: config.queueMessages,
    simulatedSynchronousJobDelayMs: config.syncJobDelayMs,
    synchronousJob: syncSummary,
    enqueueWithConfirm: publishSummary,
    avgReductionPercent: percentageReduction(syncSummary.avgMs, publishSummary.avgMs),
    p95ReductionPercent: percentageReduction(syncSummary.p95Ms, publishSummary.p95Ms),
  };
}

const formatMetric = (value, suffix = 'ms') => `${round(Number(value))}${suffix}`;

const markdownFor = (report) => {
  const lines = [
    '# Backend CV Benchmark Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Machine: ${report.environment.platform} ${report.environment.arch}, ${report.environment.cpus} CPUs, Node ${report.environment.node}`,
    '',
    '## Summary',
    '',
    `- Backend test suite: ${report.testSuite || 'Run npm test separately for the canonical functional test result.'}`,
  ];

  const upload = report.results.parallelUploads;
  lines.push(
    `- Parallel upload benchmark: ${upload.avgReductionPercent}% lower average wait time (${formatMetric(upload.sequential.avgMs)} sequential vs ${formatMetric(upload.parallel.avgMs)} parallel).`,
  );

  const redis = report.results.redisCache;
  if (redis.status === 'completed') {
    lines.push(
      `- Redis cache-hit latency: p95 ${formatMetric(redis.cacheHitLatency.p95Ms)}, avg ${formatMetric(redis.cacheHitLatency.avgMs)}, ${redis.iterations} iterations.`,
    );
  } else {
    lines.push(`- Redis cache-hit latency: skipped (${redis.reason}).`);
  }

  const httpResult = report.results.cachedHttpEndpoint;
  if (httpResult.status === 'completed') {
    lines.push(
      `- Redis-backed cached HTTP path: ${httpResult.rps} RPS, p95 ${formatMetric(httpResult.latency.p95Ms)}, concurrency ${httpResult.concurrency}.`,
    );
  } else {
    lines.push(`- Redis-backed cached HTTP path: skipped (${httpResult.reason}).`);
  }

  const queue = report.results.rabbitMQDecoupling;
  if (queue.status === 'completed') {
    lines.push(
      `- RabbitMQ enqueue benchmark: ${queue.avgReductionPercent}% lower average response wait (${formatMetric(queue.synchronousJob.avgMs)} sync job vs ${formatMetric(queue.enqueueWithConfirm.avgMs)} enqueue).`,
    );
  } else {
    lines.push(`- RabbitMQ enqueue benchmark: skipped (${queue.reason}).`);
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- These are local machine benchmarks. They are useful for CV evidence, but production numbers should be measured in production-like infrastructure.',
    '- The upload benchmark uses simulated IO-bound upload latency to validate the Promise.all strategy used by Cloudinary multiUpload.',
    '- The cached HTTP benchmark measures the Redis-backed cache path, not the full MongoDB-backed product API path.',
    '- RabbitMQ benchmark measures enqueue latency with broker confirm versus waiting synchronously for a downstream job.',
    '',
  );

  return `${lines.join('\n')}\n`;
};

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
    results: {},
  };

  console.log('[1/4] Benchmarking Promise.all upload strategy...');
  report.results.parallelUploads = await benchmarkParallelUploads();

  console.log('[2/4] Benchmarking Redis cache-hit latency...');
  report.results.redisCache = await benchmarkRedisCache();

  console.log('[3/4] Benchmarking Redis-backed cached HTTP path...');
  report.results.cachedHttpEndpoint = await benchmarkCachedHttpEndpoint();

  console.log('[4/4] Benchmarking RabbitMQ enqueue decoupling...');
  report.results.rabbitMQDecoupling = await benchmarkRabbitMQDecoupling();

  const outputDir = path.join(process.cwd(), 'benchmark-results');
  await fs.mkdir(outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `cv-backend-benchmark-${stamp}.json`);
  const mdPath = path.join(outputDir, `cv-backend-benchmark-${stamp}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, markdownFor(report), 'utf8');

  console.log('');
  console.log(markdownFor(report));
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);
}

main().catch((error) => {
  console.error('[ERROR] Benchmark failed:', error);
  process.exitCode = 1;
});
