/**
 * Logger Utility
 * Centralized logging with different levels for development and production
 * Replaces console.log with structured logging
 */

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
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string} - Formatted log string
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const normalizedMeta = normalizeMeta(meta);
  const metaStr =
    Object.keys(normalizedMeta).length > 0 ? ` ${JSON.stringify(normalizedMeta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

/**
 * Logger object with different log levels
 */
const logger = {
  /**
   * Log error messages - always logged
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata (error object, context, etc.)
   */
  error: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, meta));
    }
  },

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, meta));
    }
  },

  /**
   * Log info messages
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.info(formatMessage('INFO', message, meta));
    }
  },

  /**
   * Log debug messages - only in development
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug: (message, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', message, meta));
    }
  },

  /**
   * Log HTTP request details
   * @param {Object} req - Express request object
   * @param {string} message - Optional message
   */
  request: (req, message = 'Incoming request') => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      logger.debug(message, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.userId,
      });
    }
  },

  /**
   * Log database operation
   * @param {string} operation - Operation type (find, create, update, delete)
   * @param {string} collection - Collection name
   * @param {Object} meta - Additional metadata
   */
  db: (operation, collection, meta = {}) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      logger.debug(`DB ${operation} on ${collection}`, meta);
    }
  },
};

module.exports = logger;
