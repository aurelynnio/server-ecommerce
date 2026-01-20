const Joi = require("joi");
const { objectId } = require("./common.validator");
const { sanitizedString } = require("./sanitize");

const addressSchema = Joi.object({
  fullName: sanitizedString().required(),
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required(),
  address: sanitizedString().required(),
  city: sanitizedString().required(),
  district: sanitizedString().required(),
  ward: sanitizedString().required(),
});

const createShopValidator = Joi.object({
  name: sanitizedString().min(3).max(150).required(),
  pickupAddress: addressSchema.required(),
  description: sanitizedString().allow(""),
  logo: Joi.string().allow(""),
  banner: Joi.string().allow(""),
});

const updateShopValidator = createShopValidator.fork(
  ["name", "pickupAddress"],
  (schema) => schema.optional()
).keys({
  isActive: Joi.boolean()
});

module.exports = {
  createShopValidator,
  updateShopValidator,
  shopIdParamValidator: Joi.object({ shopId: objectId.required() }),
};
