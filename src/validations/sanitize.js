/**
 * Input Sanitization Utilities for Joi Validators
 * Provides custom Joi extensions for trimming and escaping string inputs
 * to prevent injection attacks (XSS, NoSQL injection)
 */

const joi = require("joi");

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} str - Input string to escape
 * @returns {string} - Escaped string
 */
const escapeHtml = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

/**
 * Remove MongoDB operators from string to prevent NoSQL injection
 * @param {string} str - Input string to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeMongoOperators = (str) => {
  if (typeof str !== "string") return str;
  // Remove $ at start of string or after . (MongoDB operators)
  return str.replace(/\$|\./g, "");
};

/**
 * Custom Joi extension for sanitized strings
 * Automatically trims whitespace and optionally escapes HTML
 */
const sanitizedString = () => {
  return joi.string().custom((value, helpers) => {
    if (typeof value !== "string") return value;
    // Trim whitespace
    const sanitized = value.trim();
    return sanitized;
  }, "sanitize");
};

/**
 * Custom Joi extension for HTML-escaped strings
 * Use for user-generated content that will be displayed
 */
const escapedString = () => {
  return joi.string().custom((value, helpers) => {
    if (typeof value !== "string") return value;
    // Trim and escape HTML
    let sanitized = value.trim();
    sanitized = escapeHtml(sanitized);
    return sanitized;
  }, "escape");
};

/**
 * Custom Joi extension for search/query strings
 * Sanitizes against NoSQL injection
 */
const searchString = () => {
  return joi.string().custom((value, helpers) => {
    if (typeof value !== "string") return value;
    // Trim and remove MongoDB operators
    let sanitized = value.trim();
    sanitized = sanitizeMongoOperators(sanitized);
    return sanitized;
  }, "searchSanitize");
};

/**
 * Validate and sanitize MongoDB ObjectId
 * @returns {Joi.StringSchema}
 */
const objectId = () => {
  return joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid ObjectId format",
    });
};

/**
 * Sanitize an object recursively - trim all string values
 * @param {object} obj - Object to sanitize
 * @returns {object} - Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj.trim();
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys starting with $ (MongoDB operators)
      if (key.startsWith("$")) continue;
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};

/**
 * Express middleware to sanitize request body
 */
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

module.exports = {
  escapeHtml,
  sanitizeMongoOperators,
  sanitizedString,
  escapedString,
  searchString,
  objectId,
  sanitizeObject,
  sanitizeMiddleware,
};
