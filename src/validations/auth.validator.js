const Joi = require("joi");
const { sanitizedString } = require("./sanitize");

const registerValidator = Joi.object({
  username: sanitizedString().min(3).max(30).required().messages({
    "string.min": "Tên đăng nhập phải có ít nhất 3 ký tự",
    "any.required": "Tên đăng nhập là bắt buộc",
  }),
  email: sanitizedString().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email là bắt buộc",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu phải có ít nhất 6 ký tự",
    "any.required": "Mật khẩu là bắt buộc",
  }),
});

const loginValidator = Joi.object({
  email: sanitizedString().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email là bắt buộc",
  }),
  password: Joi.string().required().messages({
    "any.required": "Mật khẩu là bắt buộc",
  }),
});

const sendVerificationCodeValidator = Joi.object({
  email: sanitizedString().email().required(),
});

const verifyEmailValidator = Joi.object({
  email: sanitizedString().email().required().messages({
    "string.email": "Email không hợp lệ",
    "any.required": "Email là bắt buộc",
  }),
  code: sanitizedString().length(6).pattern(/^\d+$/).required().messages({
    "string.length": "Mã xác thực phải đúng 6 ký tự",
    "string.pattern.base": "Mã xác thực chỉ được chứa số",
  }),
});

const forgotPasswordValidator = Joi.object({
  email: sanitizedString().email().required(),
});

const resetPasswordValidator = Joi.object({
  email: sanitizedString().email().required(),
  code: sanitizedString().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string().min(6).required(),
});

const changePasswordValidator = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).invalid(Joi.ref("oldPassword")).required().messages({
    "any.invalid": "Mật khẩu mới phải khác mật khẩu cũ",
  }),
});

module.exports = {
  registerValidator,
  loginValidator,
  sendVerificationCodeValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
};
