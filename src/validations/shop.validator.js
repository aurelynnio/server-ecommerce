const joi = require("joi");
const { sanitizedString } = require("./sanitize");

const addressSchema = joi.object({
  fullName: sanitizedString().required(),
  phone: joi
    .string()
    .pattern(/^[0-9]{10,11}$/)
    .required(),
  address: sanitizedString().required(),
  city: sanitizedString().required(),
  district: sanitizedString().required(),
  ward: sanitizedString().required(),
});

const createShopValidator = joi.object({
  name: sanitizedString().min(3).max(150).required().messages({
    "string.base": "Shop name must be a string",
    "string.min": "Shop name must be at least 3 characters",
    "any.required": "Shop name is required",
  }),
  pickupAddress: addressSchema.required(),
  description: sanitizedString().allow("").optional(),
  logo: joi.string().allow("").optional(),
  banner: joi.string().allow("").optional(),
});

const updateShopValidator = joi.object({
  name: sanitizedString().min(3).max(150).optional(),
  pickupAddress: addressSchema.optional(),
  description: sanitizedString().allow("").optional(),
  logo: joi.string().allow("").optional(),
  banner: joi.string().allow("").optional(),
});

module.exports = {
  createShopValidator,
  updateShopValidator,
};
