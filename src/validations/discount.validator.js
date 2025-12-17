const joi = require("joi");

// Create discount validator
const createDiscountValidator = joi.object({
  code: joi.string().uppercase().trim().min(3).max(20).required().messages({
    "string.base": "Discount code must be a string",
    "string.min": "Discount code must be at least 3 characters long",
    "string.max": "Discount code must be at most 20 characters long",
    "any.required": "Discount code is required",
  }),
  description: joi.string().max(500).allow("").messages({
    "string.base": "Description must be a string",
    "string.max": "Description must be at most 500 characters long",
  }),
  discountType: joi.string().valid("percent", "fixed").required().messages({
    "string.base": "Discount type must be a string",
    "any.only": "Discount type must be either 'percent' or 'fixed'",
    "any.required": "Discount type is required",
  }),
  discountValue: joi.number().positive().required()
    .when('discountType', {
      is: 'percent',
      then: joi.number().max(100)
    })
    .messages({
    "number.base": "Discount value must be a number",
    "number.positive": "Discount value must be a positive number",
    "number.max": "Percent discount cannot exceed 100%",
    "any.required": "Discount value is required",
  }),
  startDate: joi.date().iso().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),
  endDate: joi.date().iso().greater(joi.ref("startDate")).required().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),
  applicableProducts: joi
    .array()
    .items(joi.string().hex().length(24))
    .default([])
    .messages({
      "array.base": "Applicable products must be an array",
      "string.hex": "Each product ID must be a valid hex string",
      "string.length": "Each product ID must be 24 characters long",
    }),
  minOrderValue: joi.number().min(0).default(0).messages({
    "number.base": "Minimum order value must be a number",
    "number.min": "Minimum order value cannot be negative",
  }),
  usageLimit: joi.number().integer().min(1).default(1).messages({
    "number.base": "Usage limit must be a number",
    "number.integer": "Usage limit must be an integer",
    "number.min": "Usage limit must be at least 1",
  }),
  isActive: joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean",
  }),
});

// Update discount validator
const updateDiscountValidator = joi.object({
  code: joi.string().uppercase().trim().min(3).max(20).messages({
    "string.base": "Discount code must be a string",
    "string.min": "Discount code must be at least 3 characters long",
    "string.max": "Discount code must be at most 20 characters long",
  }),
  description: joi.string().max(500).allow("").messages({
    "string.base": "Description must be a string",
    "string.max": "Description must be at most 500 characters long",
  }),
  discountType: joi.string().valid("percent", "fixed").messages({
    "string.base": "Discount type must be a string",
    "any.only": "Discount type must be either 'percent' or 'fixed'",
  }),
  discountValue: joi.number().positive()
    .when('discountType', {
      is: 'percent',
      then: joi.number().max(100)
    })
    .messages({
    "number.base": "Discount value must be a number",
    "number.positive": "Discount value must be a positive number",
    "number.max": "Percent discount cannot exceed 100%",
  }),
  startDate: joi.date().iso().messages({
    "date.base": "Start date must be a valid date",
  }),
  endDate: joi.date().iso().greater(joi.ref("startDate")).messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
  }),
  applicableProducts: joi
    .array()
    .items(joi.string().hex().length(24))
    .messages({
      "array.base": "Applicable products must be an array",
      "string.hex": "Each product ID must be a valid hex string",
      "string.length": "Each product ID must be 24 characters long",
    }),
  minOrderValue: joi.number().min(0).messages({
    "number.base": "Minimum order value must be a number",
    "number.min": "Minimum order value cannot be negative",
  }),
  usageLimit: joi.number().integer().min(1).messages({
    "number.base": "Usage limit must be a number",
    "number.integer": "Usage limit must be an integer",
    "number.min": "Usage limit must be at least 1",
  }),
  isActive: joi.boolean().messages({
    "boolean.base": "isActive must be a boolean",
  }),
});

// Apply discount validator (validate discount code)
const applyDiscountValidator = joi.object({
  code: joi.string().uppercase().trim().required().messages({
    "string.base": "Discount code must be a string",
    "any.required": "Discount code is required",
  }),
  orderTotal: joi.number().positive().required().messages({
    "number.base": "Order total must be a number",
    "number.positive": "Order total must be a positive number",
    "any.required": "Order total is required",
  }),
  productIds: joi
    .array()
    .items(joi.string().hex().length(24))
    .default([])
    .messages({
      "array.base": "Product IDs must be an array",
      "string.hex": "Each product ID must be a valid hex string",
      "string.length": "Each product ID must be 24 characters long",
    }),
});

// Discount ID param validator
const discountIdParamValidator = joi.object({
  discountId: joi.string().hex().length(24).required().messages({
    "string.base": "Discount ID must be a string",
    "string.hex": "Discount ID must be a valid hex string",
    "string.length": "Discount ID must be 24 characters long",
    "any.required": "Discount ID is required",
  }),
});

// Discount code param validator
const discountCodeParamValidator = joi.object({
  code: joi.string().uppercase().trim().required().messages({
    "string.base": "Discount code must be a string",
    "any.required": "Discount code is required",
  }),
});

// Get discounts query validator
const getDiscountsQueryValidator = joi.object({
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
  isActive: joi.alternatives().try(
    joi.boolean(), 
    joi.string().valid("all", "", "true", "false")
  ).messages({
    "alternatives.match": "isActive must be a boolean or 'all'",
  }),
  discountType: joi.string().valid("percent", "fixed", "all", "").messages({
    "string.base": "Discount type must be a string",
    "any.only": "Discount type must be 'percent', 'fixed', or 'all'",
  }),
  search: joi.string().allow("").optional().messages({
    "string.base": "Search must be a string",
  }),
});

module.exports = {
  createDiscountValidator,
  updateDiscountValidator,
  applyDiscountValidator,
  discountIdParamValidator,
  discountCodeParamValidator,
  getDiscountsQueryValidator,
};
