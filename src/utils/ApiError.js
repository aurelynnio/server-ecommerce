/**
 * Custom API Error class for consistent error handling
 * Belongs to the core domain/utility layer so services, controllers,
 * and middlewares can instantiate errors without circular dependencies.
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
module.exports.ApiError = ApiError;

