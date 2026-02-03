const Joi = require("joi");

const createShopCategoryValidator = Joi.object({
  name: Joi.string().required().trim(),
  displayOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

const updateShopCategoryValidator = createShopCategoryValidator.fork(
  ["name"],
  (schema) => schema.optional(),
);

module.exports = {
  createShopCategoryValidator,
  updateShopCategoryValidator,
};
