const joi = require("joi");

const createVoucherValidator = joi.object({
  code: joi.string().min(3).required().uppercase().messages({
    "string.base": "Code must be a string",
    "string.min": "Code must be at least 3 characters",
    "any.required": "Code is required",
  }),
  name: joi.string().required().messages({
    "string.base": "Name must be a string",
    "any.required": "Name is required",
  }),
  description: joi.string().allow("").optional().messages({
    "string.base": "Description must be a string",
  }),
  type: joi.string().valid("fixed_amount", "percentage").required().messages({
    "string.base": "Type must be a string",
    "any.only": "Type must be either 'fixed_amount' or 'percentage'",
    "any.required": "Type is required",
  }),
  value: joi.number().positive().required().messages({
    "number.base": "Value must be a number",
    "number.positive": "Value must be positive",
    "any.required": "Value is required",
  }),
  maxValue: joi.number().positive().optional().messages({
    "number.base": "Max value must be a number",
    "number.positive": "Max value must be positive",
  }),
  // Scope: Shop or Platform
  scope: joi.string().valid("shop", "platform").default("shop").messages({
    "string.base": "Scope must be a string",
    "any.only": "Scope must be either 'shop' or 'platform'",
  }),
  shopId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .when("scope", {
      is: "shop",
      then: joi.required(),
      otherwise: joi.optional(),
    })
    .messages({
      "string.base": "Shop ID must be a string",
      "string.pattern.base": "Shop ID must be a valid MongoDB ObjectId",
      "any.required": "Shop ID is required for shop vouchers",
    }),
  minOrderValue: joi.number().min(0).default(0).messages({
    "number.base": "Min order value must be a number",
    "number.min": "Min order value cannot be negative",
  }),
  usageLimit: joi.number().integer().min(1).default(100).messages({
    "number.base": "Usage limit must be a number",
    "number.integer": "Usage limit must be an integer",
    "number.min": "Usage limit must be at least 1",
  }),
  usageLimitPerUser: joi.number().integer().min(1).default(1).messages({
    "number.base": "Usage limit per user must be a number",
    "number.integer": "Usage limit per user must be an integer",
    "number.min": "Usage limit per user must be at least 1",
  }),
  startDate: joi.date().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),
  endDate: joi.date().greater(joi.ref("startDate")).required().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),
  isActive: joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean",
  }),
});

const updateVoucherValidator = joi.object({
  name: joi.string().optional().messages({
    "string.base": "Name must be a string",
  }),
  description: joi.string().allow("").optional().messages({
    "string.base": "Description must be a string",
  }),
  type: joi.string().valid("fixed_amount", "percentage").optional().messages({
    "string.base": "Type must be a string",
    "any.only": "Type must be either 'fixed_amount' or 'percentage'",
  }),
  value: joi.number().positive().optional().messages({
    "number.base": "Value must be a number",
    "number.positive": "Value must be positive",
  }),
  maxValue: joi.number().positive().allow(null).optional().messages({
    "number.base": "Max value must be a number",
    "number.positive": "Max value must be positive",
  }),
  minOrderValue: joi.number().min(0).optional().messages({
    "number.base": "Min order value must be a number",
    "number.min": "Min order value cannot be negative",
  }),
  usageLimit: joi.number().integer().min(1).optional().messages({
    "number.base": "Usage limit must be a number",
    "number.integer": "Usage limit must be an integer",
    "number.min": "Usage limit must be at least 1",
  }),
  usageLimitPerUser: joi.number().integer().min(1).optional().messages({
    "number.base": "Usage limit per user must be a number",
    "number.integer": "Usage limit per user must be an integer",
    "number.min": "Usage limit per user must be at least 1",
  }),
  startDate: joi.date().optional().messages({
    "date.base": "Start date must be a valid date",
  }),
  endDate: joi.date().optional().messages({
    "date.base": "End date must be a valid date",
  }),
  isActive: joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean",
  }),
}).min(1);

const voucherIdParamValidator = joi.object({
  id: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid voucher ID format",
      "any.required": "Voucher ID is required",
    }),
});

const getVouchersQueryValidator = joi.object({
  page: joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  scope: joi.string().valid("shop", "platform", "all").optional().messages({
    "string.base": "Scope must be a string",
    "any.only": "Scope must be one of: shop, platform, all",
  }),
  isActive: joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean",
  }),
  search: joi.string().allow("").optional().messages({
    "string.base": "Search must be a string",
  }),
});

module.exports = {
  createVoucherValidator,
  updateVoucherValidator,
  voucherIdParamValidator,
  getVouchersQueryValidator,
};
