const joi = require("joi");

const createPaymentValidator = joi.object({
  orderId: joi.string().hex().length(24).required().messages({
    "string.base": "Order ID must be a string",
    "string.hex": "Order ID must be a valid hex string",
    "string.length": "Order ID must be 24 characters long",
    "any.required": "Order ID is required",
  }),
});

const paymentOrderIdParamValidator = joi.object({
  orderId: joi.string().hex().length(24).required().messages({
    "string.base": "Order ID must be a string",
    "string.hex": "Order ID must be a valid hex string",
    "string.length": "Order ID must be 24 characters long",
    "any.required": "Order ID is required",
  }),
});

module.exports = {
  createPaymentValidator,
  paymentOrderIdParamValidator,
};
