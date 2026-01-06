/**
 * Centralized Error Handler Middleware
 * Standardizes all error responses across the application
 */

const { StatusCodes } = require("http-status-codes");
const logger = require("../utils/logger");

/**
 * Custom API Error class for consistent error handling
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error type to status code mapping
 */
const errorStatusMap = {
  ValidationError: StatusCodes.BAD_REQUEST,
  CastError: StatusCodes.BAD_REQUEST,
  JsonWebTokenError: StatusCodes.UNAUTHORIZED,
  TokenExpiredError: StatusCodes.UNAUTHORIZED,
  MongoServerError: StatusCodes.BAD_REQUEST,
  MulterError: StatusCodes.BAD_REQUEST,
};

/**
 * Get appropriate status code for error
 * @param {Error} err - Error object
 * @returns {number} - HTTP status code
 */
const getStatusCode = (err) => {
  // If error has statusCode, use it
  if (err.statusCode) return err.statusCode;

  // Map error types to status codes
  if (errorStatusMap[err.name]) return errorStatusMap[err.name];

  // MongoDB duplicate key error
  if (err.code === 11000) return StatusCodes.CONFLICT;

  // Default to internal server error
  return StatusCodes.INTERNAL_SERVER_ERROR;
};

/**
 * Get user-friendly error message
 * @param {Error} err - Error object
 * @returns {string} - User-friendly message
 */
const getErrorMessage = (err) => {
  // Validation errors (Joi, Mongoose)
  if (err.name === "ValidationError") {
    if (err.details) {
      // Joi validation error
      return err.details.map((d) => d.message).join(", ");
    }
    // Mongoose validation error
    return Object.values(err.errors || {})
      .map((e) => e.message)
      .join(", ");
  }

  // MongoDB CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return `Invalid ${err.path}: ${err.value}`;
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return `${field || "Field"} already exists`;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return "Invalid token. Please log in again.";
  }
  if (err.name === "TokenExpiredError") {
    return "Token expired. Please log in again.";
  }

  // Multer file upload errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") return "File too large";
    if (err.code === "LIMIT_UNEXPECTED_FILE") return "Unexpected file field";
    return err.message;
  }

  // Return original message for operational errors
  if (err.isOperational) {
    return err.message;
  }

  // Hide internal error details in production
  if (process.env.NODE_ENV === "production") {
    return "Something went wrong. Please try again later.";
  }

  return err.message || "Internal server error";
};

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = getStatusCode(err);
  const message = getErrorMessage(err);
  const status = `${statusCode}`.startsWith("4") ? "fail" : "error";

  // Log error
  if (process.env.NODE_ENV !== "production") {
    logger.error("Request error", {
      name: err.name,
      message: err.message,
      statusCode,
      stack: err.stack,
    });
  } else {
    logger.error("Request error", {
      name: err.name,
      message: err.message,
      statusCode,
    });
  }

  // Send standardized error response
  res.status(statusCode).json({
    status,
    message,
    code: statusCode,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
      error: err.name,
    }),
  });
};

/**
 * Handle 404 Not Found errors
 */
const notFoundHandler = (req, res, next) => {
  const err = new ApiError(
    StatusCodes.NOT_FOUND,
    `Route ${req.originalUrl} not found`
  );
  next(err);
};

module.exports = {
  ApiError,
  errorHandler,
  notFoundHandler,
  getStatusCode,
  getErrorMessage,
};
