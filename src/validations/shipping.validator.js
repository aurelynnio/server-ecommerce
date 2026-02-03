const Joi = require("joi");
const { objectId } = require("./common.validator");

const ruleSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string()
    .valid("fixed", "weight_based", "quantity_based")
    .required(),
  baseFee: Joi.number().min(0).required(),
  stepUnit: Joi.number().min(0),
  stepFee: Joi.number().min(0),
});

const createTemplateValidator = Joi.object({
  name: Joi.string().required(),
  rules: Joi.array().items(ruleSchema).required(),
  isDefault: Joi.boolean().default(false),
});

const updateTemplateValidator = createTemplateValidator.fork(
  ["name", "rules"],
  (schema) => schema.optional(),
);

const templateIdParamValidator = Joi.object({ id: objectId.required() });

module.exports = {
  createTemplateValidator,
  updateTemplateValidator,
  templateIdParamValidator,
};
