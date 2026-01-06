const joi = require("joi");

const createCategoryValidator = joi.object({
  name: joi.string().required().trim(),
  displayOrder: joi.number().integer().optional(),
  isActive: joi.boolean().optional(),
});

const updateCategoryValidator = joi.object({
  name: joi.string().optional().trim(),
  displayOrder: joi.number().integer().optional(),
  isActive: joi.boolean().optional(),
});

module.exports = {
  createCategoryValidator,
  updateCategoryValidator,
};
