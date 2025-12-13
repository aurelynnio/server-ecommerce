const joi = require("joi");

// Add item to cart validator
const addToCartValidator = joi.object({
  productId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.base": "Product ID must be a string",
      "string.pattern.base": "Product ID must be a valid MongoDB ObjectId",
      "any.required": "Product ID is required",
    }),
  variantId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null, "")
    .messages({
      "string.base": "Variant ID must be a string",
      "string.pattern.base": "Variant ID must be a valid MongoDB ObjectId",
    }),
  quantity: joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number",
    "number.integer": "Quantity must be an integer",
    "number.min": "Quantity must be at least 1",
    "any.required": "Quantity is required",
  }),
});

// Update cart item quantity validator
const updateCartItemValidator = joi.object({
  quantity: joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number",
    "number.integer": "Quantity must be an integer",
    "number.min": "Quantity must be at least 1",
    "any.required": "Quantity is required",
  }),
});

// Cart item ID param validator
const cartItemIdValidator = joi.object({
  itemId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid cart item ID format",
      "any.required": "Cart item ID is required",
    }),
});

module.exports = {
  addToCartValidator,
  updateCartItemValidator,
  cartItemIdValidator,
};
