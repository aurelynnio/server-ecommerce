const Joi = require("joi");
const { objectId, pagination } = require("./common.validator");
const { sanitizedString } = require("./sanitize");

const addressValidator = Joi.object({
  fullName: sanitizedString().min(2).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required(),
  address: sanitizedString().required(),
  city: sanitizedString().required(),
  district: sanitizedString().required(),
  ward: sanitizedString().required(),
  isDefault: Joi.boolean().default(false),
});

const updateProfileValidator = Joi.object({
  username: sanitizedString().min(3).max(50),
  email: sanitizedString().email(),
  avatar: Joi.string().uri().allow(null, ""),
});

const changePasswordValidator = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).different(Joi.ref("oldPassword")).required(),
});

const adminCreateUserValidator = Joi.object({
  username: sanitizedString().min(3).max(50).required(),
  email: sanitizedString().email().required(),
  password: Joi.string().min(6),
  roles: Joi.string().valid("user", "admin", "seller").default("user"),
  isVerifiedEmail: Joi.boolean().default(false),
});

const adminUpdateUserValidator = Joi.object({
  id: objectId.optional(),
  username: sanitizedString().min(3).max(50),
  email: sanitizedString().email(),
  roles: Joi.string().valid("user", "admin", "seller"),
  isVerifiedEmail: Joi.boolean(),
  avatar: Joi.string().uri().allow(null, ""),
  permissions: Joi.array().items(Joi.string()),
});

module.exports = {
  updateProfileValidator,
  addAddressValidator: addressValidator,
  updateAddressValidator: addressValidator.fork(
    ["fullName", "phone", "address", "city", "district", "ward"],
    (schema) => schema.optional()
  ),
  changePasswordValidator,
  createUserValidator: adminCreateUserValidator,
  updateUserValidator: adminUpdateUserValidator,
  updateUserByIdValidator: adminUpdateUserValidator.keys({ id: Joi.forbidden() }),
  updateRoleValidator: Joi.object({
    roles: Joi.string().valid("user", "admin", "seller").required()
  }),
  mongoIdParamValidator: Joi.object({ id: objectId.required() }),
  addressIdParamValidator: Joi.object({ addressId: objectId.required() }),
  paginationQueryValidator: Joi.object({
    ...pagination,
    role: Joi.string().valid("user", "admin", "seller").allow(""),
    isVerifiedEmail: Joi.boolean().allow(""),
  }),
};
