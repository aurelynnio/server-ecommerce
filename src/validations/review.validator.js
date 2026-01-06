const joi = require("joi");
const { escapedString } = require("./sanitize");

// Create review validator
const createReviewValidator = joi.object({
  productId: joi.string().hex().length(24).required().messages({
    "string.base": "Product ID must be a string",
    "string.hex": "Product ID must be a valid hex string",
    "string.length": "Product ID must be 24 characters long",
    "any.required": "Product ID is required",
  }),
  rating: joi.number().integer().min(1).max(5).required().messages({
    "number.base": "Rating must be a number",
    "number.integer": "Rating must be an integer",
    "number.min": "Rating must be at least 1",
    "number.max": "Rating must be at most 5",
    "any.required": "Rating is required",
  }),
  comment: escapedString().max(1000).allow("").messages({
    "string.base": "Comment must be a string",
    "string.max": "Comment must be at most 1000 characters long",
  }),
});

// Update review validator
const updateReviewValidator = joi.object({
  rating: joi.number().integer().min(1).max(5).messages({
    "number.base": "Rating must be a number",
    "number.integer": "Rating must be an integer",
    "number.min": "Rating must be at least 1",
    "number.max": "Rating must be at most 5",
  }),
  comment: escapedString().max(1000).allow("").messages({
    "string.base": "Comment must be a string",
    "string.max": "Comment must be at most 1000 characters long",
  }),
});

// Review ID param validator
const reviewIdParamValidator = joi.object({
  reviewId: joi.string().hex().length(24).required().messages({
    "string.base": "Review ID must be a string",
    "string.hex": "Review ID must be a valid hex string",
    "string.length": "Review ID must be 24 characters long",
    "any.required": "Review ID is required",
  }),
});

// Product ID param validator
const productIdParamValidator = joi.object({
  productId: joi.string().hex().length(24).required().messages({
    "string.base": "Product ID must be a string",
    "string.hex": "Product ID must be a valid hex string",
    "string.length": "Product ID must be 24 characters long",
    "any.required": "Product ID is required",
  }),
});

// Get reviews query validator
const getReviewsQueryValidator = joi.object({
  page: joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must be at most 100",
  }),
  rating: joi.number().integer().min(1).max(5).messages({
    "number.base": "Rating must be a number",
    "number.integer": "Rating must be an integer",
    "number.min": "Rating must be at least 1",
    "number.max": "Rating must be at most 5",
  }),
  sort: joi
    .string()
    .valid("newest", "oldest", "highest", "lowest")
    .default("newest")
    .messages({
      "string.base": "Sort must be a string",
      "any.only": "Sort must be one of: newest, oldest, highest, lowest",
    }),
});

module.exports = {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator,
  productIdParamValidator,
  getReviewsQueryValidator,
};
