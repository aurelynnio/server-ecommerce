const Joi = require("joi");
const { objectId, pagination } = require("./common.validator");
const { sanitizedString, searchString } = require("./sanitize");

const priceSchema = Joi.object({
  currentPrice: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).less(Joi.ref("currentPrice")).allow(null, 0),
  currency: Joi.string().default("VND"),
});

const variantSchema = Joi.object({
  _id: Joi.string().optional(),
  name: Joi.string().required(),
  sku: Joi.string().allow(""),
  color: Joi.string().allow(""),
  price: Joi.number().min(0).required(),
  stock: Joi.number().integer().min(0).required(),
  images: Joi.array().items(Joi.string()),
});

const attributeSchema = Joi.object({
  name: Joi.string().required(),
  value: Joi.string().required(),
});

const createProductValidator = Joi.object({
  name: sanitizedString().min(3).max(200).required(),
  description: sanitizedString().min(10).required(),
  category: objectId.required(),
  shopCategory: objectId.allow("", null),
  brand: Joi.string().allow(""),
  price: priceSchema.required(),
  stock: Joi.number().integer().min(0).default(0),
  variants: Joi.array().items(variantSchema),
  attributes: Joi.array().items(attributeSchema),
  weight: Joi.number().min(0),
  dimensions: Joi.object({
    height: Joi.number().min(0),
    width: Joi.number().min(0),
    length: Joi.number().min(0),
  }),
  images: Joi.array().items(Joi.string()),
  status: Joi.string().valid("draft", "published", "suspended").default("published"),
});

const updateProductValidator = createProductValidator.fork(
  ["name", "description", "category", "price"],
  (schema) => schema.optional()
).keys({
  id: objectId.optional(),
  existingDescriptionImages: Joi.array().items(Joi.string()),
  existingVariantImages: Joi.array().items(Joi.object({
    variantIndex: Joi.number(),
    existing: Joi.array().items(Joi.string())
  }))
});

const getProductsQueryValidator = Joi.object({
  ...pagination,
  category: objectId,
  brand: Joi.string(),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  status: Joi.string().valid("draft", "published", "suspended", "all"),
});

const addVariantValidator = variantSchema.keys({
  _id: Joi.forbidden(), // Should not provide _id when adding
  sku: Joi.string().required(), // SKU usually required when adding
});

const updateVariantValidator = variantSchema.fork(
  Object.keys(variantSchema.describe().keys),
  (schema) => schema.optional()
).keys({
  _id: Joi.forbidden(),
});

module.exports = {
  createProductValidator,
  updateProductValidator,
  getProductsQueryValidator,
  addVariantValidator,
  updateVariantValidator,
  mongoIdParamValidator: Joi.object({ id: objectId.required() }),
  slugParamValidator: Joi.object({ slug: Joi.string().required() }),
  categoryIdParamValidator: Joi.object({ categoryId: objectId.required() }),
  categorySlugParamValidator: Joi.object({ slug: Joi.string().required() }),
  variantIdsParamValidator: Joi.object({
    id: objectId.required(),
    variantId: objectId.required(), // Variant ID is typically an ObjectId
  }),
  paginationQueryValidator: Joi.object(pagination),
  limitQueryValidator: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
  searchQueryValidator: Joi.object({
    q: searchString.required(),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};
