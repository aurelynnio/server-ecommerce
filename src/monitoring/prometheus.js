const client = require('prom-client');

const METRICS_PREFIX = process.env.METRICS_PREFIX || 'backend_';

const registry = new client.Registry();

const buildMetricName = (name) => `${METRICS_PREFIX}${name}`;

const activeRequests = new client.Gauge({
  name: buildMetricName('http_requests_in_flight'),
  help: 'Current number of in-flight HTTP requests.',
  registers: [registry],
});

const requestCounter = new client.Counter({
  name: buildMetricName('http_requests_total'),
  help: 'Total number of HTTP requests.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const requestDuration = new client.Histogram({
  name: buildMetricName('http_request_duration_seconds'),
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

if (process.env.NODE_ENV !== 'test' && process.env.METRICS_DEFAULTS_ENABLED !== 'false') {
  client.collectDefaultMetrics({
    prefix: METRICS_PREFIX,
    register: registry,
  });
}

const isMetricsEnabled = () => process.env.METRICS_ENABLED !== 'false';

const normalizeRoute = (req) => {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}`;
  }

  if (req.baseUrl) {
    return req.baseUrl;
  }

  return 'unmatched';
};

const metricsMiddleware = (req, res, next) => {
  if (!isMetricsEnabled() || req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime.bigint();
  let completed = false;

  activeRequests.inc();

  const finalize = () => {
    if (completed) return;
    completed = true;

    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route: normalizeRoute(req),
      status_code: String(res.statusCode),
    };

    activeRequests.dec();
    requestCounter.inc(labels);
    requestDuration.observe(labels, durationSeconds);
  };

  res.once('finish', finalize);
  res.once('close', finalize);

  return next();
};

const metricsHandler = async (_req, res, next) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (error) {
    next(error);
  }
};

module.exports = {
  isMetricsEnabled,
  metricsMiddleware,
  metricsHandler,
  normalizeRoute,
  registry,
};
