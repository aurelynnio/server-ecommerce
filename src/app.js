const ex = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const initRoutes = require('./routes');
const http = require('http');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');
const { StatusCodes } = require('http-status-codes');
const corsMiddleware = require('./middlewares/cors.middleware');
const { sanitizeMiddleware } = require('./validations/sanitize');
const { sendJson } = require('./shared/res/formatResponse');
const chatbotMetrics = require('./monitoring/chatbot.metrics');
const app = ex();

const server = http.createServer(app);

// Trust proxy when behind a reverse proxy / load balancer
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv) {
  const parsed =
    trustProxyEnv === 'true'
      ? 1
      : Number.isNaN(Number(trustProxyEnv))
        ? trustProxyEnv
        : Number(trustProxyEnv);
  app.set('trust proxy', parsed);
}

// Server timeouts to protect against slowloris and stalled connections
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65 * 1000;
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 70 * 1000;
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 120 * 1000;

// Middlewares
const requestIdMiddleware = require('./middlewares/requestId.middleware');
const { metricsMiddleware } = require('./middlewares/metrics.middleware');
const healthRouter = require('./routes/health.router');

app.use(requestIdMiddleware);
app.use(metricsMiddleware);

const morganEnabled =
  process.env.MORGAN_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
if (morganEnabled) {
  app.use(morgan(process.env.MORGAN_FORMAT || 'dev'));
}
app.use(corsMiddleware);
app.use(ex.json());
app.use(ex.urlencoded({ extended: true }));
app.use(sanitizeMiddleware);
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false }));

// Interactive Swagger OpenAPI Documentation
const swaggerRouter = require('./docs/swagger.router');
app.use('/api-docs', swaggerRouter);
app.use('/docs', (req, res) => res.redirect('/api-docs'));

// Health probes (Liveness & Readiness)
app.use('/health', healthRouter);

initRoutes(app);

app.get('/', (req, res) => {
  return sendJson(res, { status: 'API OK' }, 200);
});


// Prometheus scrape endpoint.
// - Dev: mở để tiện debug.
// - Production: bắt buộc cấu hình METRICS_BEARER_TOKEN (Prometheus scrape config
//   set `authorization: Bearer <token>`) HOẶC METRICS_ALLOWED_IPS (comma-separated,
//   IP của Prometheus server; lưu ý TRUST_PROXY khi đứng sau reverse proxy).
//   Không cấu hình gì → 403 (secure by default, không leak operational metrics).
const METRICS_BEARER_TOKEN = process.env.METRICS_BEARER_TOKEN;
const METRICS_ALLOWED_IPS = String(process.env.METRICS_ALLOWED_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

const isMetricsAuthorized = (req) => {
  if (process.env.NODE_ENV !== 'production') return true;

  if (METRICS_BEARER_TOKEN) {
    const actual = Buffer.from(String(req.headers.authorization || ''));
    const expected = Buffer.from(`Bearer ${METRICS_BEARER_TOKEN}`);
    // Timing-safe so sánh để không lộ token qua thời gian phản hồi
    return (
      actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
    );
  }

  if (METRICS_ALLOWED_IPS.length > 0) {
    return METRICS_ALLOWED_IPS.includes(req.ip);
  }

  return false;
};

app.get('/metrics', async (req, res) => {
  if (!isMetricsAuthorized(req)) {
    return res.status(StatusCodes.FORBIDDEN).end('Forbidden');
  }
  try {
    const { metrics, contentType } = await chatbotMetrics.getAggregatedMetrics();
    res.set('Content-Type', contentType);
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler - must be last middleware
app.use(errorHandler);

module.exports = {
  server,
  app,
};

