const joi = require("joi");
const { sanitizedString, searchString } = require("./sanitize");


// Update user profile validator
const updateProfileValidator = joi.object({
  username: sanitizedString().min(3).max(50).messages({
    "string.base": "Username must be a string",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must be at most 50 characters long",
  }),
  email: sanitizedString().email().messages({
    "string.base": "Email must be a string",
    "string.email": "Email must be a valid email address",
  }),
  avatar: joi.string().uri().allow(null).messages({
    "string.base": "Avatar must be a string",
    "string.uri": "Avatar must be a valid URL",
  }),
});

// Add address validator
const addAddressValidator = joi.object({
  fullName: sanitizedString().min(2).max(100).required().messages({
    "string.base": "Full name must be a string",
    "string.min": "Full name must be at least 2 characters long",
    "string.max": "Full name must be at most 100 characters long",
    "any.required": "Full name is required",
  }),
  phone: joi
    .string()
    .pattern(/^[0-9]{10,11}$/)
    .messages({
      "string.base": "Phone must be a string",
      "string.pattern.base": "Phone must be 10-11 digits",
    }),
  address: sanitizedString().messages({
    "string.base": "Address must be a string",
    "any.required": "Address is required",
  }),
  city: sanitizedString().required().messages({
    "string.base": "City must be a string",
    "any.required": "City is required",
  }),
  district: sanitizedString().required().messages({
    "string.base": "District must be a string",
    "any.required": "District is required",
  }),
  ward: sanitizedString().required().messages({
    "string.base": "Ward must be a string",
    "any.required": "Ward is required",
  }),
  isDefault: joi.boolean().messages({
    "boolean.base": "isDefault must be a boolean",
  }),
});

// Update address validator
const updateAddressValidator = joi.object({
  fullName: sanitizedString().min(2).max(100).messages({
    "string.base": "Full name must be a string",
    "string.min": "Full name must be at least 2 characters long",
    "string.max": "Full name must be at most 100 characters long",
  }),
  phone: joi
    .string()
    .pattern(/^[0-9]{10,11}$/)
    .messages({
      "string.base": "Phone must be a string",
      "string.pattern.base": "Phone must be 10-11 digits",
    }),
  address: sanitizedString().optional().messages({
    "string.base": "Address must be a string",
  }),
  city: sanitizedString().optional().messages({
    "string.base": "City must be a string",
  }),
  district: sanitizedString().optional().messages({
    "string.base": "District must be a string",
  }),
  ward: sanitizedString().optional().messages({
    "string.base": "Ward must be a string",
  }),
  isDefault: joi.boolean().optional().messages({
    "boolean.base": "isDefault must be a boolean",
  }),
});

// Change password validator
const changePasswordValidator = joi.object({
  oldPassword: joi.string().required().messages({
    "string.base": "Old password must be a string",
    "any.required": "Old password is required",
  }),
  newPassword: joi.string().min(6).required().messages({
    "string.base": "New password must be a string",
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

// MongoDB ObjectId param validator
const mongoIdParamValidator = joi.object({
  id: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid user ID format",
      "any.required": "User ID is required",
    }),
});

// Address ID param validator
const addressIdParamValidator = joi.object({
  addressId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid address ID format",
      "any.required": "Address ID is required",
    }),
});

// Update user by ID validator (Admin only)
// Update user validator (with ID in body)
const updateUserValidator = joi.object({
  id: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid user ID format",
      "any.required": "User ID is required",
    }),
  username: joi.string().min(3).max(50).messages({
    "string.base": "Username must be a string",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must be at most 50 characters long",
  }),
  email: joi.string().email().messages({
    "string.base": "Email must be a string",
    "string.email": "Email must be a valid email address",
  }),
  roles: joi.string().valid("user", "admin", "seller").messages({
    "string.base": "Role must be a string",
    "any.only": "Role must be one of: user, admin, seller",
  }),
  isVerifiedEmail: joi.boolean().messages({
    "boolean.base": "isVerifiedEmail must be a boolean",
  }),
  avatar: joi.string().uri().allow(null, "").messages({
    "string.base": "Avatar must be a string",
    "string.uri": "Avatar must be a valid URL",
  }),
  permissions: joi.array().items(joi.string()).messages({
    "array.base": "Permissions must be an array",
    "string.base": "Each permission must be a string",
  }),
});

const updateUserByIdValidator = joi.object({
  username: joi.string().min(3).max(50).messages({
    "string.base": "Username must be a string",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must be at most 50 characters long",
  }),
  email: joi.string().email().messages({
    "string.base": "Email must be a string",
    "string.email": "Email must be a valid email address",
  }),
  roles: joi.string().valid("user", "admin", "seller").messages({
    "string.base": "Role must be a string",
    "any.only": "Role must be one of: user, admin, seller",
  }),
  isVerifiedEmail: joi.boolean().messages({
    "boolean.base": "isVerifiedEmail must be a boolean",
  }),
  avatar: joi.string().uri().allow(null, "").messages({
    "string.base": "Avatar must be a string",
    "string.uri": "Avatar must be a valid URL",
  }),
});

// Update user role validator (Admin only)
const updateRoleValidator = joi.object({
  roles: joi.string().valid("user", "admin", "seller").required().messages({
    "string.base": "Role must be a string",
    "any.only": "Role must be one of: user, admin, seller",
    "any.required": "Role is required",
  }),
});

// Update permissions validator (Admin only)
const updatePermissionsValidator = joi.object({
  permissions: joi.array().items(joi.string()).required().messages({
    "array.base": "Permissions must be an array",
    "string.base": "Each permission must be a string",
    "any.required": "Permissions is required",
  }),
});

// Create user validator (Admin only)
const createUserValidator = joi.object({
  username: sanitizedString().min(3).max(50).required().messages({
    "string.base": "Username must be a string",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must be at most 50 characters long",
    "any.required": "Username is required",
  }),
  email: sanitizedString().email().required().messages({
    "string.base": "Email must be a string",
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  roles: joi.string().valid("user", "admin", "seller").default("user").messages({
    "string.base": "Role must be a string",
    "any.only": "Role must be one of: user, admin, seller",
  }),
  isVerifiedEmail: joi.boolean().default(false).messages({
    "boolean.base": "isVerifiedEmail must be a boolean",
  }),
  password: joi.string().optional().min(6).messages({
    "string.base": "Password must be a string",
    "string.min": "Password must be at least 6 characters long",
  }),
});

// Pagination query validator
const paginationQueryValidator = joi.object({
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
    "number.max": "Limit cannot exceed 100",
    "any.required": "Limit is required",
  }),
  search: searchString().allow("").messages({
    "string.base": "Search must be a string",
  }),
  role: joi.string().valid("user", "admin", "seller").allow("").messages({
    "string.base": "Role must be a string",
    "any.only": "Role must be one of: user, admin, seller",
  }),
  isVerifiedEmail: joi.boolean().allow("").messages({
    "boolean.base": "isVerifiedEmail must be a boolean",
  }),
});

module.exports = {
  createUserValidator,
  updateUserValidator,
  updateUserByIdValidator,
  updateProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  changePasswordValidator,
  mongoIdParamValidator,
  addressIdParamValidator,
  updateRoleValidator,
  updatePermissionsValidator,
  paginationQueryValidator,
};
