const joi = require("joi");
const { sanitizedString } = require("./sanitize");

// Shipping address schema
const shippingAddressSchema = joi.object({
  fullName: sanitizedString().min(2).max(100).required().messages({
    "string.base": "Full name must be a string",
    "string.min": "Full name must be at least 2 characters long",
    "string.max": "Full name must be at most 100 characters long",
    "any.required": "Full name is required",
  }),
  phone: joi
    .string()
    .pattern(/^[0-9]{10,11}$/)
    .required()
    .messages({
      "string.base": "Phone must be a string",
      "string.pattern.base": "Phone must be 10-11 digits",
      "any.required": "Phone is required",
    }),
  address: sanitizedString().min(5).required().messages({
    "string.base": "Address must be a string",
    "string.min": "Address must be at least 5 characters long",
    "any.required": "Address is required",
  }),
  city: sanitizedString().required().messages({
    "string.base": "City must be a string",
    "any.required": "City is required",
  }),
  district: sanitizedString().allow("").messages({
    "string.base": "District must be a string",
  }),
  ward: sanitizedString().allow("").messages({
    "string.base": "Ward must be a string",
  }),
  note: sanitizedString().allow("").messages({
    "string.base": "Note must be a string",
  }),
});

// Create order validator
const createOrderValidator = joi.object({
  cartItemIds: joi
    .array()
    .items(joi.string().hex().length(24))
    .min(1)
    .required()
    .messages({
      "array.base": "Cart item IDs must be an array",
      "array.min": "At least one cart item must be selected",
      "string.hex": "Each cart item ID must be a valid hex string",
      "string.length": "Each cart item ID must be 24 characters long",
      "any.required":
        "Cart item IDs are required. Please select items to checkout",
    }),
  shippingAddress: shippingAddressSchema.required().messages({
    "any.required": "Shipping address is required",
  }),
  paymentMethod: joi.string().valid("cod", "vnpay").default("cod").messages({
    "string.base": "Payment method must be a string",
    "any.only": "Payment method must be either 'cod' or 'vnpay'",
  }),
  discountCode: joi.forbidden().messages({
    "any.unknown":
      "discountCode is deprecated, please use platformVoucher instead",
  }),
  platformVoucher: joi
    .string()
    .uppercase()
    .trim()
    .allow("")
    .default(null)
    .messages({
      "string.base": "Platform voucher code must be a string",
    }),
  shopVouchers: joi
    .array()
    .items(
      joi.object({
        shopId: joi.string().hex().length(24).required().messages({
          "string.base": "Shop ID must be a string",
          "string.hex": "Shop ID must be a valid hex string",
          "string.length": "Shop ID must be 24 characters long",
          "any.required": "Shop ID is required for shop voucher",
        }),
        code: joi.string().uppercase().trim().required().messages({
          "string.base": "Voucher code must be a string",
          "any.required": "Voucher code is required",
        }),
      })
    )
    .default([])
    .messages({
      "array.base": "Shop vouchers must be an array",
    }),
  note: sanitizedString().allow("").messages({
    "string.base": "Note must be a string",
  }),
});

// Update order status validator
const updateOrderStatusValidator = joi.object({
  status: joi
    .string()
    .valid(
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned"
    )
    .required()
    .messages({
      "string.base": "Status must be a string",
      "any.only":
        "Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled, returned",
      "any.required": "Status is required",
    }),
});

// MongoDB ObjectId validator
const orderIdParamValidator = joi.object({
  orderId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid order ID format",
      "any.required": "Order ID is required",
    }),
});

const getOrdersQueryValidator = joi.object({
  page: joi.number().integer().min(1).default(1).optional().messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: joi
    .number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
  status: joi
    .string()
    .valid(
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned"
    )
    .optional()
    .messages({
      "string.base": "Status must be a string",
      "any.only":
        "Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled, returned",
    }),
  paymentStatus: joi
    .string()
    .valid("unpaid", "paid", "refunded")
    .optional()
    .messages({
      "string.base": "Payment status must be a string",
      "any.only": "Payment status must be one of: unpaid, paid, refunded",
    }),
  paymentMethod: joi.string().valid("cod", "vnpay", "momo").optional().messages({
    "string.base": "Payment method must be a string",
    "any.only": "Payment method must be one of: cod, vnpay, momo",
  }),
  userId: joi.string().hex().length(24).optional().messages({
    "string.base": "User ID must be a string",
    "string.hex": "User ID must be a valid hex string",
    "string.length": "User ID must be 24 characters long",
  }),
});

module.exports = {
  createOrderValidator,
  updateOrderStatusValidator,
  orderIdParamValidator,
  getOrdersQueryValidator,
};
