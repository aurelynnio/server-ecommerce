const joi = require("joi");
const { sanitizedString, searchString, objectId } = require("./sanitize");

// Validate price object
const priceSchema = joi.object({
  _id: joi.string().optional(), // Allow _id from MongoDB
  currentPrice: joi.number().positive().required().messages({
    "number.base": "Current price must be a number",
    "number.positive": "Current price must be positive",
    "any.required": "Current price is required",
  }),
  discountPrice: joi.number().positive().allow(null).messages({
    "number.base": "Discount price must be a number",
    "number.positive": "Discount price must be positive",
  }),
  currency: joi.string().default("VND").messages({
    "string.base": "Currency must be a string",
  }),
});

// Variant schema - Simplified: only color differentiation
// Matches product.model.js variantSchema
const variantSchema = joi.object({
  _id: joi.string().optional().allow(""),
  name: joi.string().required().messages({
    "string.base": "Variant name must be a string",
    "any.required": "Variant name is required",
  }),
  sku: joi.string().optional().allow("").messages({
    "string.base": "SKU must be a string",
  }),
  color: joi.string().optional().allow("").messages({
    "string.base": "Color must be a string",
  }),
  price: joi.number().min(0).required().messages({
    "number.base": "Price must be a number",
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),
  stock: joi.number().integer().min(0).required().messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
    "any.required": "Stock is required",
  }),
  sold: joi.number().integer().min(0).default(0).messages({
    "number.base": "Sold must be a number",
    "number.integer": "Sold must be an integer",
    "number.min": "Sold cannot be negative",
  }),
  images: joi.array().items(joi.string()).optional().messages({
    "array.base": "Images must be an array",
  }),
});

// Attribute schema for product specifications
const attributeSchema = joi.object({
  name: joi.string().required().messages({
    "string.base": "Attribute name must be a string",
    "any.required": "Attribute name is required",
  }),
  value: joi.string().required().messages({
    "string.base": "Attribute value must be a string",
    "any.required": "Attribute value is required",
  }),
});

// Dimensions schema
const dimensionsSchema = joi.object({
  height: joi.number().min(0).optional().messages({
    "number.base": "Height must be a number",
    "number.min": "Height cannot be negative",
  }),
  width: joi.number().min(0).optional().messages({
    "number.base": "Width must be a number",
    "number.min": "Width cannot be negative",
  }),
  length: joi.number().min(0).optional().messages({
    "number.base": "Length must be a number",
    "number.min": "Length cannot be negative",
  }),
});

// Create product validator
const createProductValidator = joi.object({
  name: sanitizedString().min(3).max(200).required().messages({
    "string.base": "Product name must be a string",
    "string.min": "Product name must be at least 3 characters long",
    "string.max": "Product name must be at most 200 characters long",
    "any.required": "Product name is required",
  }),
  description: sanitizedString().min(10).required().messages({
    "string.base": "Description must be a string",
    "string.min": "Description must be at least 10 characters long",
    "any.required": "Description is required",
  }),
  slug: joi
    .string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .messages({
      "string.base": "Slug must be a string",
      "string.pattern.base":
        "Slug must be lowercase with hyphens only (e.g., product-name)",
    }),
  category: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.base": "Category must be a string",
      "string.pattern.base": "Category must be a valid MongoDB ObjectId",
      "any.required": "Category is required",
    }),
  shopCategory: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow("")
    .optional()
    .messages({
      "string.base": "Shop category must be a string",
      "string.pattern.base": "Shop category must be a valid MongoDB ObjectId",
    }),
  brand: sanitizedString().max(100).allow("").messages({
    "string.base": "Brand must be a string",
    "string.max": "Brand must be at most 100 characters",
  }),
  tags: joi.array().items(sanitizedString()).messages({
    "array.base": "Tags must be an array",
    "string.base": "Each tag must be a string",
  }),
  // Sizes - Product level (applies to all variants)
  sizes: joi.alternatives().try(
    joi.array().items(joi.string()),
    joi.string()
  ).optional().messages({
    "array.base": "Sizes must be an array",
  }),
  // Description images only (variant images are in variants[].images)
  descriptionImages: joi.array().items(joi.string()).max(20).optional().messages({
    "array.base": "Description images must be an array",
    "array.max": "Maximum 20 description images allowed",
  }),
  video: joi.string().uri().allow("", null).optional().messages({
    "string.base": "Video must be a string",
    "string.uri": "Video must be a valid URL",
  }),
  price: priceSchema.required().messages({
    "any.required": "Price is required",
  }),
  stock: joi.number().integer().min(0).default(0).messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
  }),
  // Variants - Color variants only
  variants: joi.array().items(variantSchema).max(100).messages({
    "array.base": "Variants must be an array",
    "array.max": "Maximum 100 variants allowed",
  }),
  // Shipping
  shippingTemplate: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow("")
    .optional()
    .messages({
      "string.base": "Shipping template must be a string",
      "string.pattern.base": "Shipping template must be a valid MongoDB ObjectId",
    }),
  weight: joi.number().min(0).optional().messages({
    "number.base": "Weight must be a number",
    "number.min": "Weight cannot be negative",
  }),
  dimensions: dimensionsSchema.optional().messages({
    "object.base": "Dimensions must be an object",
  }),
  // Attributes/Specifications
  attributes: joi.array().items(attributeSchema).max(30).optional().messages({
    "array.base": "Attributes must be an array",
    "array.max": "Maximum 30 attributes allowed",
  }),
  // Flags
  isFeatured: joi.boolean().default(false).messages({
    "boolean.base": "isFeatured must be a boolean",
  }),
  isNewArrival: joi.boolean().default(false).messages({
    "boolean.base": "isNewArrival must be a boolean",
  }),
  status: joi.string().valid("draft", "published", "suspended").default("published").messages({
    "string.base": "Status must be a string",
    "any.only": "Status must be one of: draft, published, suspended",
  }),
});

const updateProductValidator = joi
  .object({
    id: joi.string().optional(),
    name: joi.string().min(3).max(200).optional().messages({
      "string.base": "Product name must be a string",
      "string.min": "Product name must be at least 3 characters long",
      "string.max": "Product name must be at most 200 characters long",
    }),
    description: joi.string().min(10).optional().messages({
      "string.base": "Description must be a string",
      "string.min": "Description must be at least 10 characters long",
    }),
    slug: joi
      .string()
      .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional()
      .messages({
        "string.base": "Slug must be a string",
        "string.pattern.base":
          "Slug must be lowercase with hyphens only (e.g., product-name)",
      }),
    category: joi
      .string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        "string.base": "Category must be a string",
        "string.pattern.base": "Category must be a valid MongoDB ObjectId",
      }),
    shopCategory: joi
      .string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow("")
      .optional()
      .messages({
        "string.base": "Shop category must be a string",
        "string.pattern.base": "Shop category must be a valid MongoDB ObjectId",
      }),
    brand: joi.string().max(100).allow("").optional().messages({
      "string.base": "Brand must be a string",
      "string.max": "Brand must be at most 100 characters",
    }),
    tags: joi.array().items(joi.string()).optional().messages({
      "array.base": "Tags must be an array",
      "string.base": "Each tag must be a string",
    }),
    // Sizes - Product level
    sizes: joi.alternatives().try(
      joi.array().items(joi.string()),
      joi.string()
    ).optional().messages({
      "array.base": "Sizes must be an array",
    }),
    // Description images
    descriptionImages: joi.array().items(joi.string()).max(20).optional().messages({
      "array.base": "Description images must be an array",
      "array.max": "Maximum 20 description images allowed",
    }),
    existingDescriptionImages: joi.alternatives().try(
      joi.array().items(joi.string()),
      joi.string()
    ).optional().messages({
      "array.base": "Existing description images must be an array",
    }),
    video: joi.string().uri().allow("", null).optional().messages({
      "string.base": "Video must be a string",
      "string.uri": "Video must be a valid URL",
    }),
    price: priceSchema.optional().messages({
      "object.base": "Price must be an object",
    }),
    stock: joi.number().integer().min(0).optional().messages({
      "number.base": "Stock must be a number",
      "number.integer": "Stock must be an integer",
      "number.min": "Stock cannot be negative",
    }),
    // Variants - Color variants only
    variants: joi.alternatives().try(
      joi.array().items(variantSchema).max(100),
      joi.string() // Allow JSON string
    ).optional().messages({
      "array.base": "Variants must be an array",
      "array.max": "Maximum 100 variants allowed",
    }),
    existingVariantImages: joi.alternatives().try(
      joi.array().items(joi.object({
        variantIndex: joi.number().required(),
        existing: joi.array().items(joi.string()).required(),
      })),
      joi.string()
    ).optional().messages({
      "array.base": "Existing variant images must be an array",
    }),
    // Shipping
    shippingTemplate: joi
      .string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow("")
      .optional()
      .messages({
        "string.base": "Shipping template must be a string",
        "string.pattern.base": "Shipping template must be a valid MongoDB ObjectId",
      }),
    weight: joi.number().min(0).optional().messages({
      "number.base": "Weight must be a number",
      "number.min": "Weight cannot be negative",
    }),
    dimensions: dimensionsSchema.optional().messages({
      "object.base": "Dimensions must be an object",
    }),
    // Attributes/Specifications
    attributes: joi.alternatives().try(
      joi.array().items(attributeSchema).max(30),
      joi.string()
    ).optional().messages({
      "array.base": "Attributes must be an array",
      "array.max": "Maximum 30 attributes allowed",
    }),
    // Flags
    isFeatured: joi
      .boolean()
      .truthy("true")
      .falsy("false")
      .optional()
      .messages({
        "boolean.base": "isFeatured must be a boolean",
      }),
    isNewArrival: joi
      .boolean()
      .truthy("true")
      .falsy("false")
      .optional()
      .messages({
        "boolean.base": "isNewArrival must be a boolean",
      }),
    status: joi.string().valid("draft", "published", "suspended").optional().messages({
      "string.base": "Status must be a string",
      "any.only": "Status must be one of: draft, published, suspended",
    }),
  })
  .min(1);

// Add variant validator - Simplified structure
const addVariantValidator = joi.object({
  name: joi.string().required().messages({
    "string.base": "Variant name must be a string",
    "any.required": "Variant name is required",
  }),
  sku: joi.string().optional().allow("").messages({
    "string.base": "SKU must be a string",
  }),
  color: joi.string().optional().allow("").messages({
    "string.base": "Color must be a string",
  }),
  price: joi.number().min(0).required().messages({
    "number.base": "Price must be a number",
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),
  stock: joi.number().integer().min(0).default(0).messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
  }),
  images: joi.array().items(joi.string()).optional().messages({
    "array.base": "Images must be an array",
  }),
});

// Update variant validator - Simplified structure
const updateVariantValidator = joi.object({
  name: joi.string().optional().messages({
    "string.base": "Variant name must be a string",
  }),
  sku: joi.string().optional().allow("").messages({
    "string.base": "SKU must be a string",
  }),
  color: joi.string().optional().allow("").messages({
    "string.base": "Color must be a string",
  }),
  price: joi.number().min(0).optional().messages({
    "number.base": "Price must be a number",
    "number.min": "Price cannot be negative",
  }),
  stock: joi.number().integer().min(0).optional().messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
  }),
  images: joi.array().items(joi.string()).optional().messages({
    "array.base": "Images must be an array",
  }),
});

// Query params validator for getAllProducts
const getProductsQueryValidator = joi.object({
  page: joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  sort: joi.string().default("-createdAt").messages({
    "string.base": "Sort must be a string",
  }),
  category: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Category must be a string",
      "string.pattern.base": "Category must be a valid MongoDB ObjectId",
    }),
  brand: joi.string().messages({
    "string.base": "Brand must be a string",
  }),
  minPrice: joi.number().min(0).messages({
    "number.base": "Min price must be a number",
    "number.min": "Min price cannot be negative",
  }),
  maxPrice: joi.number().min(0).messages({
    "number.base": "Max price must be a number",
    "number.min": "Max price cannot be negative",
  }),
  tags: joi
    .alternatives()
    .try(joi.string(), joi.array().items(joi.string()))
    .messages({
      "alternatives.base": "Tags must be a string or array of strings",
    }),
  search: searchString().allow("").messages({
    "string.base": "Search must be a string",
  }),
  status: joi.string().valid("draft", "published", "suspended", "all").default("published").messages({
    "string.base": "Status must be a string",
    "any.only": "Status must be one of: draft, published, suspended, all",
  }),
  shop: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Shop must be a string",
      "string.pattern.base": "Shop must be a valid MongoDB ObjectId",
    }),
});

// Validate MongoDB ObjectId param
const mongoIdParamValidator = joi.object({
  id: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid product ID format",
      "any.required": "Product ID is required",
    }),
});

// Validate slug param
const slugParamValidator = joi.object({
  slug: joi
    .string()
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid slug format",
      "any.required": "Slug is required",
    }),
});

// Validate category ID param
const categoryIdParamValidator = joi.object({
  categoryId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid category ID format",
      "any.required": "Category ID is required",
    }),
});

// Validate category slug params
const categorySlugParamValidator = joi.object({
  slug: joi
    .string()
    .min(1)
    .max(100)
    .pattern(/^[a-z0-9-']+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Category slug must contain only lowercase letters, numbers, hyphens, and apostrophes",
      "string.min": "Category slug must be at least 1 character long",
      "string.max": "Category slug must not exceed 100 characters",
      "any.required": "Category slug is required",
    }),
});

// Validate variant IDs params
const variantIdsParamValidator = joi.object({
  id: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid product ID format",
      "any.required": "Product ID is required",
    }),
  variantId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid variant ID format",
      "any.required": "Variant ID is required",
    }),
});

// Validate pagination query params
const paginationQueryValidator = joi.object({
  page: joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  sort: joi.string().default("-createdAt").messages({
    "string.base": "Sort must be a string",
  }),
});

// Validate limit query param
const limitQueryValidator = joi.object({
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
});

// Validate query params for featured/new arrival/on sale products
const specialProductsQueryValidator = joi.object({
  page: joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  category: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Category must be a valid MongoDB ObjectId",
    }),
  brand: joi.string().messages({
    "string.base": "Brand must be a string",
  }),
  minPrice: joi.number().min(0).messages({
    "number.base": "Min price must be a number",
    "number.min": "Min price cannot be negative",
  }),
  maxPrice: joi.number().min(0).messages({
    "number.base": "Max price must be a number",
    "number.min": "Max price cannot be negative",
  }),
  sortBy: joi
    .string()
    .valid("price", "name", "createdAt", "soldCount")
    .default("createdAt")
    .messages({
      "string.base": "Sort by must be a string",
      "any.only": "Sort by must be one of: price, name, createdAt, soldCount",
    }),
  sortOrder: joi.string().valid("asc", "desc").default("desc").messages({
    "string.base": "Sort order must be a string",
    "any.only": "Sort order must be either 'asc' or 'desc'",
  }),
});


const searchQueryValidator = joi.object({
  q: searchString().required().min(1).messages({
    "string.base": "Search query must be a string",
    "string.min": "Search query must be at least 1 character long",
    "any.required": "Search query is required",
  }),
  limit: joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
});

module.exports = {
  createProductValidator,
  updateProductValidator,
  addVariantValidator,
  updateVariantValidator,
  getProductsQueryValidator,
  mongoIdParamValidator,
  slugParamValidator,
  categoryIdParamValidator,
  categorySlugParamValidator,
  variantIdsParamValidator,
  paginationQueryValidator,
  limitQueryValidator,
  specialProductsQueryValidator,
  searchQueryValidator,
};


