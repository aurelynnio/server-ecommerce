const ex = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const initRoutes = require("./routes");
const http = require("http");
const {
  errorHandler,
  notFoundHandler,
} = require("./middlewares/errorHandler.middleware");
const corsMiddleware = require("./middlewares/cors.middleware");
const { globalLimiter } = require("./middlewares/rateLimited.middleware");
const { sanitizeMiddleware } = require("./validations/sanitize");
const { sendJson } = require("./shared/res/formatResponse");
const app = ex();

const server = http.createServer(app);

// Trust proxy when behind a reverse proxy / load balancer
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv) {
  const parsed =
    trustProxyEnv === "true"
      ? 1
      : Number.isNaN(Number(trustProxyEnv))
        ? trustProxyEnv
        : Number(trustProxyEnv);
  app.set("trust proxy", parsed);
}

// Server timeouts to protect against slowloris and stalled connections
server.keepAliveTimeout =
  Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65 * 1000;
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS) || 70 * 1000;
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 120 * 1000;

// Middlewares
const morganEnabled =
  process.env.MORGAN_ENABLED === "true" ||
  process.env.NODE_ENV !== "production";
if (morganEnabled) {
  app.use(morgan(process.env.MORGAN_FORMAT || "dev"));
}
app.use(corsMiddleware);
app.use(globalLimiter);
app.use(ex.json());
app.use(ex.urlencoded({ extended: true }));
app.use(sanitizeMiddleware);
app.use(cookieParser());
app.use(helmet());

initRoutes(app);

app.get("/", (req, res) => {
  return sendJson(res, { status: "API OK" }, 200);
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler - must be last middleware
app.use(errorHandler);

module.exports = {
  server,
  app,
};
