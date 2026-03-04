const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('./errorHandler.middleware');

/**
 * Middleware to parse JSON string fields from multipart/form-data
 * @param {string[]} fields - Array of field names that need parsing
 * @returns {Function} Express middleware
 */
const parseJsonFields =
  (fields = []) =>
  (req, res, next) => {
    if (!req.body) return next();

    const errors = [];

    fields.forEach((field) => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (_error) {
          errors.push(`Invalid JSON format for field '${field}'`);
        }
      }
    });

    if (errors.length > 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, errors.join(', '));
    }

    next();
  };

module.exports = parseJsonFields;
