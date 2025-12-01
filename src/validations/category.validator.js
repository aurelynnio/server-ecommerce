const joi = require("joi");

// Create category validator
const createCategoryValidator = joi.object({
  name: joi.string().trim().min(2).max(100).required().messages({
    "string.base": "Category name must be a string",
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name must be at most 100 characters long",
    "any.required": "Category name is required",
  }),
  description: joi.string().max(500).allow("").messages({
    "string.base": "Description must be a string",
    "string.max": "Description must be at most 500 characters long",
  }),
  slug: joi
    .string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      "string.base": "Slug must be a string",
      "string.pattern.base":
        "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
  parentCategory: joi
    .string()
    .hex()
    .length(24)
    .allow(null)
    .default(null)
    .messages({
      "string.base": "Parent category must be a string",
      "string.hex": "Parent category must be a valid hex string",
      "string.length": "Parent category must be 24 characters long",
    }),
  images: joi.array().items(joi.string().uri()).default([]).messages({
    "array.base": "Images must be an array",
    "string.uri": "Each image must be a valid URL",
  }),
  isActive: joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean",
  }),
});

// Update category validator
const updateCategoryValidator = joi.object({
  name: joi.string().trim().min(2).max(100).messages({
    "string.base": "Category name must be a string",
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name must be at most 100 characters long",
  }),
  description: joi.string().max(500).allow("").messages({
    "string.base": "Description must be a string",
    "string.max": "Description must be at most 500 characters long",
  }),
  slug: joi
    .string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      "string.base": "Slug must be a string",
      "string.pattern.base":
        "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
  parentCategory: joi.string().hex().length(24).allow(null).messages({
    "string.base": "Parent category must be a string",
    "string.hex": "Parent category must be a valid hex string",
    "string.length": "Parent category must be 24 characters long",
  }),
  images: joi.array().items(joi.string().uri()).messages({
    "array.base": "Images must be an array",
    "string.uri": "Each image must be a valid URL",
  }),
  isActive: joi.boolean().messages({
    "boolean.base": "isActive must be a boolean",
  }),
});

// Category ID param validator
const categoryIdParamValidator = joi.object({
  categoryId: joi.string().hex().length(24).required().messages({
    "string.base": "Category ID must be a string",
    "string.hex": "Category ID must be a valid hex string",
    "string.length": "Category ID must be 24 characters long",
    "any.required": "Category ID is required",
  }),
});

// Category slug param validator
const categorySlugParamValidator = joi.object({
  slug: joi
    .string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .required()
    .messages({
      "string.base": "Slug must be a string",
      "string.pattern.base":
        "Slug must contain only lowercase letters, numbers, and hyphens",
      "any.required": "Slug is required",
    }),
});

// Get categories query validator
const getCategoriesQueryValidator = joi.object({
  page: joi.number().integer().min(1).required().messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
    "any.required": "Page is required",
  }),
  limit: joi.number().integer().min(1).max(100).required().messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must be at most 100",
    "any.required": "Limit is required",
  }),
  isActive: joi.boolean().messages({
    "boolean.base": "isActive must be a boolean",
  }),
  parentCategory: joi.string().hex().length(24).allow(null, "null").messages({
    "string.base": "Parent category must be a string",
    "string.hex": "Parent category must be a valid hex string",
    "string.length": "Parent category must be 24 characters long",
  }),
  search: joi.string().trim().allow("").messages({
    "string.base": "Search must be a string",
  }),
});

module.exports = {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdParamValidator,
  categorySlugParamValidator,
  getCategoriesQueryValidator,
};
