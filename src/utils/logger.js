/**
 * Logger Utility
 * Centralized structured logging with NDJSON (Newline Delimited JSON) format
 * Compatible with modern log shippers (Loki, Elasticsearch, Datadog, CloudWatch)
 * Includes AsyncLocalStorage RequestId/TraceId correlation propagation.
 */

const { getRequestId } = require('./asyncContext');

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

const normalizeError = (err) => {
  if (!(err instanceof Error)) return err;
  return { name: err.name, message: err.message, stack: err.stack };
};

const normalizeMeta = (meta) => {
  if (!meta) return {};
  if (meta instanceof Error) return normalizeError(meta);
  if (typeof meta !== 'object') return { meta };

  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = v instanceof Error ? normalizeError(v) : v;
  }
  return out;
};

/**
 * Format log message as pure NDJSON (Newline Delimited JSON)
 * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string} - JSON stringified single log line
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const requestId = getRequestId();
  const normalizedMeta = normalizeMeta(meta);

  // Allow explicit text formatting when LOG_FORMAT=text
  if (process.env.LOG_FORMAT === 'text') {
    const metaStr =
      Object.keys(normalizedMeta).length > 0 ? ` ${JSON.stringify(normalizedMeta)}` : '';
    const reqStr = requestId ? ` [${requestId}]` : '';
    return `[${timestamp}] [${level}]${reqStr} ${message}${metaStr}`;
  }


  const logPayload = {
    timestamp,
    level,
    message,
    ...(requestId ? { requestId } : {}),
    ...(Object.keys(normalizedMeta).length > 0 ? { meta: normalizedMeta } : {}),
  };

  return JSON.stringify(logPayload);
};

const logger = {
  /**
   * Log error messages - always logged
   */
  error: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, meta));
    }
  },

  /**
   * Log warning messages
   */
  warn: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, meta));
    }
  },

  /**
   * Log info messages
   */
  info: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.info(formatMessage('INFO', message, meta));
    }
  },

  /**
   * Log debug messages - only in development
   */
  debug: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', message, meta));
    }
  },

  /**
   * Log HTTP request details
   */
  request: (req, message = 'Incoming request') => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      logger.debug(message, {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userId: req.user?.userId || req.user?._id,
      });
    }
  },

  /**
   * Log database operation
   */
  db: (operation, collection, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      logger.debug(`DB ${operation} on ${collection}`, meta);
    }
  },


  // Export helpers for testing
  _formatMessage: formatMessage,
  _normalizeMeta: normalizeMeta,
  _normalizeError: normalizeError,
};

module.exports = logger;
