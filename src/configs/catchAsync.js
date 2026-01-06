const { StatusCodes } = require("http-status-codes");

/**
 * Async error wrapper for Express route handlers
 * Catches async errors and passes them to the global error handler
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Wrapped function that catches errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};




module.exports = catchAsync;
