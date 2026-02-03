const Joi = require("joi");
const { objectId, pagination } = require("./common.validator");
const { sanitizedString } = require("./sanitize");

const createCategoryValidator = Joi.object({
  name: sanitizedString().min(2).max(100).required(),
  description: Joi.string().max(500).allow(""),
  slug: Joi.string()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/),
  parentCategory: objectId.allow(null),
  images: Joi.array().items(Joi.string().uri()),
  isActive: Joi.boolean().default(true),
});

const updateCategoryValidator = createCategoryValidator.fork(
  ["name"],
  (schema) => schema.optional(),
);

const categoryIdParamValidator = Joi.object({
  categoryId: objectId.required(),
});
const categorySlugParamValidator = Joi.object({
  slug: Joi.string().required(),
});

const getCategoriesQueryValidator = Joi.object({
  ...pagination,
  isActive: Joi.boolean(),
  parentCategory: objectId.allow(null, "null"),
});

module.exports = {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdParamValidator,
  categorySlugParamValidator,
  getCategoriesQueryValidator,
};
