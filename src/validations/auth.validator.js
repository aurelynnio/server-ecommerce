const joi = require("joi");
const { sanitizedString } = require("./sanitize");

const loginValidator = joi.object({
  email: sanitizedString().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
});

const registerValidator = joi.object({
  username: sanitizedString().min(3).max(30).required().messages({
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must be at most 30 characters long",
    "any.required": "Username is required",
  }),
  email: sanitizedString().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
  confirmPassword: joi.string().valid(joi.ref("password")).required().messages({
    "any.only": "Confirm password must match password",
    "any.required": "Confirm password is required",
  }),
});

const sendVerificationCodeValidator = joi.object({
  email: sanitizedString().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
});

const verifyEmailValidator = joi.object({
  code: sanitizedString().length(6).pattern(/^\d+$/).required().messages({
    "string.length": "Verification code must be 6 digits",
    "string.pattern.base": "Verification code must contain only numbers",
    "any.required": "Verification code is required",
  }),
});

const forgotPasswordValidator = joi.object({
  email: sanitizedString().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
});

const resetPasswordValidator = joi.object({
  email: sanitizedString().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  code: sanitizedString().length(6).pattern(/^\d+$/).required().messages({
    "string.length": "Reset code must be 6 digits",
    "string.pattern.base": "Reset code must contain only numbers",
    "any.required": "Reset code is required",
  }),
  newPassword: joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

const changePasswordValidator = joi.object({
  currentPassword: joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

module.exports = {
  loginValidator,
  registerValidator,
  sendVerificationCodeValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
};
