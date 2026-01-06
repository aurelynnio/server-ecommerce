const joi = require("joi");

const startEndSchema = joi.object({
  code: joi.string().required(),
  fee: joi.number().min(0).required(),
});

const createTemplateValidator = joi.object({
  name: joi.string().required(),
  rules: joi
    .array()
    .items(
      joi.object({
        name: joi.string().required(),
        type: joi
          .string()
          .valid("fixed", "weight_based", "quantity_based")
          .required(),
        baseFee: joi.number().min(0).required(),
        stepUnit: joi.number().min(0).optional(),
        stepFee: joi.number().min(0).optional(),
      })
    )
    .required(),
  isDefault: joi.boolean().optional(),
});

const updateTemplateValidator = joi.object({
  name: joi.string().optional(),
  rules: joi
    .array()
    .items(
      joi.object({
        name: joi.string().required(),
        type: joi
          .string()
          .valid("fixed", "weight_based", "quantity_based")
          .required(),
        baseFee: joi.number().min(0).required(),
        stepUnit: joi.number().min(0).optional(),
        stepFee: joi.number().min(0).optional(),
      })
    )
    .optional(),
  isDefault: joi.boolean().optional(),
});

module.exports = {
  createTemplateValidator,
  updateTemplateValidator,
};
