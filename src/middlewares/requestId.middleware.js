const crypto = require('crypto');
const { asyncLocalStorage } = require('../utils/asyncContext');

/**
 * Middleware that extracts or generates a unique correlation X-Request-Id
 * and binds it to AsyncLocalStorage for distributed tracing across all logs and downstream calls.
 */
const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim()
      : crypto.randomUUID();

  // Expose on response header and request object
  res.setHeader('X-Request-Id', requestId);
  req.id = requestId;
  req.requestId = requestId;

  asyncLocalStorage.run({ requestId, method: req.method, path: req.path }, () => {
    next();
  });
};

module.exports = requestIdMiddleware;
