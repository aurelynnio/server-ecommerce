const joi = require("joi");

const createVoucherValidator = joi.object({
  code: joi.string().min(3).required().uppercase(),
  name: joi.string().required(),
  description: joi.string().allow("").optional(),
  type: joi.string().valid("fixed_amount", "percentage").required(),
  value: joi.number().positive().required(),
  maxValue: joi.number().positive().optional(),
  minOrderValue: joi.number().min(0).default(0),
  usageLimit: joi.number().integer().min(1).default(100),
  usageLimitPerUser: joi.number().integer().min(1).default(1),
  startDate: joi.date().required(),
  endDate: joi.date().greater(joi.ref("startDate")).required(),
  isActive: joi.boolean().default(true),
});

module.exports = {
  createVoucherValidator,
};
