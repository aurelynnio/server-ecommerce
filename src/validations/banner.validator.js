const Joi = require("joi");
const { objectId } = require("./common.validator");

const createBannerValidator = Joi.object({
  title: Joi.string().trim().min(3).max(100).required(),
  subtitle: Joi.string().trim().min(3).max(200).required(),
  link: Joi.string().trim().allow(""),
  theme: Joi.string().valid("light", "dark").default("light"),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  imageUrl: Joi.string().uri(),
});

const updateBannerValidator = createBannerValidator.fork(
  ["title", "subtitle"],
  (schema) => schema.optional(),
);

const bannerIdParamValidator = Joi.object({ id: objectId.required() });

module.exports = {
  createBannerValidator,
  updateBannerValidator,
  bannerIdParamValidator,
};
