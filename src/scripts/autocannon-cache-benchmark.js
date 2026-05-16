const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const Redis = require('ioredis');

const config = {
  redisUrl: process.env.BENCH_REDIS_URL || 'redis://127.0.0.1:6380',
  durationSeconds: Number(process.env.BENCH_AUTOCANNON_DURATION) || 10,
  connections: (process.env.BENCH_AUTOCANNON_CONNECTIONS || '25,50,100')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0),
  pipelining: Number(process.env.BENCH_AUTOCANNON_PIPELINING) || 1,
};

const round = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
};

const buildPayload = () => ({
  data: Array.from({ length: 48 }, (_, index) => ({
    id: `product-${index}`,
    name: `Benchmark Product ${index}`,
    slug: `benchmark-product-${index}`,
    brand: index % 2 === 0 ? 'Brand A' : 'Brand B',
    category: index % 3 === 0 ? 'Shoes' : 'Apparel',
    price: 100000 + index * 2500,
    image: `https://cdn.example.com/products/${index}.jpg`,
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

function runAutocannon(url, connections) {
  const args = [
    process.platform === 'win32' ? 'npx' : 'autocannon',
    ...(process.platform === 'win32' ? ['autocannon'] : []),
    '-j',
    '-d',
    String(config.durationSeconds),
    '-c',
    String(connections),
    '-p',
    String(config.pipelining),
    url,
  ];

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child =
      process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', args.join(' ')], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          })
        : spawn('npx', args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`autocannon exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse autocannon JSON: ${error.message}\n${stdout}`));
      }
    });
  });
}

function normalizeResult(raw, connections) {
  return {
    connections,
    durationSeconds: config.durationSeconds,
    pipelining: config.pipelining,
    requestsAverage: round(raw.requests?.average),
    requestsTotal: raw.requests?.total || 0,
    latencyAverageMs: round(raw.latency?.average),
    latencyP50Ms: round(raw.latency?.p50),
    latencyP97_5Ms: round(raw.latency?.p97_5),
    latencyP99Ms: round(raw.latency?.p99),
    throughputAverageBytes: round(raw.throughput?.average),
    errors: raw.errors || 0,
    timeouts: raw.timeouts || 0,
    non2xx: raw.non2xx || 0,
  };
}

function bestByRps(results) {
  return [...results].sort((a, b) => b.requestsAverage - a.requestsAverage)[0];
}

function bestSub10ms(results) {
  return [...results]
    .filter((result) => result.latencyP97_5Ms < 10)
    .sort((a, b) => b.requestsAverage - a.requestsAverage)[0];
}

function buildMarkdown(report) {
  const lines = [
    '# Autocannon Cache Benchmark Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Machine: ${report.environment.platform} ${report.environment.arch}, ${report.environment.cpus} CPUs, Node ${report.environment.node}`,
    `Target: ${report.target}`,
    '',
    '## Results',
    '',
    '| Connections | Avg RPS | Total Requests | Avg Latency | p97.5 Latency | p99 Latency | Errors | Timeouts | Non-2xx |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.results.map(
      (result) =>
        `| ${result.connections} | ${result.requestsAverage} | ${result.requestsTotal} | ${result.latencyAverageMs}ms | ${result.latencyP97_5Ms}ms | ${result.latencyP99Ms}ms | ${result.errors} | ${result.timeouts} | ${result.non2xx} |`,
    ),
    '',
    '## Summary',
    '',
  ];

  if (report.best) {
    lines.push(
      `- Best RPS: ${report.best.requestsAverage} RPS at ${report.best.connections} connections with p97.5 ${report.best.latencyP97_5Ms}ms.`,
    );
  }

  if (report.bestSub10ms) {
    lines.push(
      `- Best sub-10ms p97.5 run: ${report.bestSub10ms.requestsAverage} RPS at ${report.bestSub10ms.connections} connections with p97.5 ${report.bestSub10ms.latencyP97_5Ms}ms.`,
    );
  } else {
    lines.push('- No run reached sub-10ms p97.5 latency in this local benchmark.');
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- This benchmark uses a local Redis-backed cached product-discovery-style endpoint.',
    '- It measures the cache response path only, not the full MongoDB-backed production API path.',
    '- Autocannon reports p97.5, not p95, so this report uses p97.5 as a stricter latency percentile.',
    '- Local results depend heavily on CPU, Windows networking, Docker and current machine load.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

async function main() {
  let redis;

  try {
    redis = await connectRedis();
  } catch (error) {
    console.error(`[ERROR] Redis unavailable at ${config.redisUrl}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const cacheKey = 'autocannon-benchmark:products';
  const payload = buildPayload();
  await redis.set(cacheKey, JSON.stringify(payload), 'EX', 300);

  const server = http.createServer(async (_req, res) => {
    try {
      const cached = await redis.get(cacheKey);
      if (!cached) {
        res.statusCode = 404;
        res.end('cache miss');
        return;
      }

      res.setHeader('content-type', 'application/json');
      res.end(cached);
    } catch (error) {
      res.statusCode = 500;
      res.end(error.message);
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const target = `http://127.0.0.1:${port}/products`;

  const results = [];

  try {
    for (const connections of config.connections) {
      console.log(
        `[autocannon] Running ${config.durationSeconds}s test with ${connections} connections...`,
      );
      const raw = await runAutocannon(target, connections);
      results.push(normalizeResult(raw, connections));
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await redis.del(cacheKey);
    await redis.quit();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      hostname: os.hostname(),
    },
    config,
    results,
    best: bestByRps(results),
    bestSub10ms: bestSub10ms(results),
  };

  const outputDir = path.join(process.cwd(), 'benchmark-results');
  await fs.mkdir(outputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `autocannon-cache-benchmark-${stamp}.json`);
  const mdPath = path.join(outputDir, `autocannon-cache-benchmark-${stamp}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, buildMarkdown(report), 'utf8');

  console.log('');
  console.log(buildMarkdown(report));
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);
}

main().catch((error) => {
  console.error('[ERROR] Autocannon benchmark failed:', error);
  process.exitCode = 1;
});
