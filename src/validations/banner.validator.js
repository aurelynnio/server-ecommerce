const joi = require("joi");

/**
 * Validation schema for creating a new banner
 */
const createBannerValidator = joi.object({
  title: joi.string().trim().min(3).max(100).required().messages({
    "string.base": "Title must be a string",
    "string.empty": "Title cannot be empty",
    "string.min": "Title must be at least 3 characters",
    "string.max": "Title cannot exceed 100 characters",
    "any.required": "Title is required",
  }),
  subtitle: joi.string().trim().min(3).max(200).required().messages({
    "string.base": "Subtitle must be a string",
    "string.empty": "Subtitle cannot be empty",
    "string.min": "Subtitle must be at least 3 characters",
    "string.max": "Subtitle cannot exceed 200 characters",
    "any.required": "Subtitle is required",
  }),
  link: joi.string().trim().allow("").optional().messages({
    "string.base": "Link must be a string",
  }),
  theme: joi.string().valid("light", "dark").default("light").messages({
    "any.only": "Theme must be either 'light' or 'dark'",
  }),
  order: joi.number().integer().min(0).default(0).messages({
    "number.base": "Order must be a number",
    "number.integer": "Order must be an integer",
    "number.min": "Order cannot be negative",
  }),
  isActive: joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean",
  }),
  // imageUrl is usually handled by multer and service, but if passed in body:
  imageUrl: joi.string().uri().optional().messages({
    "string.uri": "Invalid image URL format",
  }),
});

/**
 * Validation schema for updating an existing banner
 */
const updateBannerValidator = joi.object({
  title: joi.string().trim().min(3).max(100).optional().messages({
    "string.base": "Title must be a string",
    "string.min": "Title must be at least 3 characters",
    "string.max": "Title cannot exceed 100 characters",
  }),
  subtitle: joi.string().trim().min(3).max(200).optional().messages({
    "string.base": "Subtitle must be a string",
    "string.min": "Subtitle must be at least 3 characters",
    "string.max": "Subtitle cannot exceed 200 characters",
  }),
  link: joi.string().trim().allow("").optional(),
  theme: joi.string().valid("light", "dark").optional(),
  order: joi.number().integer().min(0).optional(),
  isActive: joi.boolean().optional(),
  imageUrl: joi.string().uri().optional(),
}).min(1); // At least one field must be provided for update

/**
 * Validation for banner ID in params
 */
const bannerIdParamValidator = joi.object({
  id: joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    "string.pattern.base": "Invalid banner ID format",
    "any.required": "Banner ID is required",
  }),
});

module.exports = {
  createBannerValidator,
  updateBannerValidator,
  bannerIdParamValidator,
};
