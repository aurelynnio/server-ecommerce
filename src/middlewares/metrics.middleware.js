const { client, register } = require('../monitoring/metrics.registry');

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed by the application',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of active in-flight HTTP requests currently executing',
  labelNames: ['method'],
  registers: [register],
});

/**
 * Normalizes request path into a generic route pattern to avoid
 * Prometheus High Cardinality TSDB explosions on dynamic IDs/UUIDs/ObjectIds.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
const normalizeRoute = (req) => {
  // If matched Express route pattern exists (e.g. /api/products/:id)
  if (req.route && req.route.path) {
    const basePath = req.baseUrl || '';
    const routePath = typeof req.route.path === 'string' ? req.route.path : '';
    return `${basePath}${routePath}` || '/';
  }


  // Fallback cleaner for unmatched 404s, custom handlers, or static routes
  const rawPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path || '/';

  return rawPath
    // Replace standard UUIDs (8-4-4-4-12)
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ':id')
    // Replace MongoDB ObjectIds (24 hex characters)
    .replace(/\b[0-9a-fA-F]{24}\b/g, ':id')
    // Replace purely numeric IDs in path segments (/12345/ -> /:id/)
    .replace(/\/\d+(?=\/|$)/g, '/:id');
};

/**
 * Global Express RED (Rate, Errors, Duration) metrics middleware
 */
const metricsMiddleware = (req, res, next) => {
  const path = req.path || '';

  // Exclude scraping, health checks, documentation and browser noise from metric tracking
  if (
    path === '/metrics' ||
    path.startsWith('/health') ||
    path.startsWith('/api-docs') ||
    path.startsWith('/docs') ||
    path === '/live' ||
    path === '/ready' ||
    path === '/favicon.ico'
  ) {
    return next();
  }


  httpRequestsInFlight.inc({ method: req.method });
  const start = process.hrtime();

  res.on('finish', () => {
    httpRequestsInFlight.dec({ method: req.method });
    const elapsed = process.hrtime(start);
    const durationInSeconds = elapsed[0] + elapsed[1] / 1e9;
    const route = normalizeRoute(req);
    const statusCode = String(res.statusCode);

    httpRequestDurationSeconds.observe(
      { method: req.method, route, status_code: statusCode },
      durationInSeconds,
    );

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });
  });

  next();
};

module.exports = {
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsInFlight,
  normalizeRoute,
};
