const joi = require("joi");

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

// Update product validator (all fields optional)
// Trong file validator của bạn
const variantSchema = joi.object({
  // THÊM .optional() HOẶC .allow(null) CHO CÁC FIELD KHÔNG BẮT BUỘC
  name: joi.string().optional().allow("").messages({
    "string.base": "Variant name must be a string",
  }),
  sku: joi.string().required().messages({
    "string.base": "SKU must be a string",
    "any.required": "SKU is required",
  }),
  color: joi.string().optional().allow("").messages({
    "string.base": "Color must be a string",
  }),
  size: joi.string().optional().allow("").messages({
    "string.base": "Size must be a string",
  }),
  stock: joi.number().integer().min(0).required().messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
    "any.required": "Stock is required",
  }),
  images: joi.array().items(joi.string().uri()).optional().messages({
    "array.base": "Images must be an array",
    "string.uri": "Each image must be a valid URL",
  }),
  price: joi
    .object({
      currentPrice: joi.number().min(0).required().messages({
        "number.base": "Current price must be a number",
        "number.min": "Current price cannot be negative",
        "any.required": "Current price is required",
      }),
      discountPrice: joi.number().min(0).optional().allow(null).messages({
        "number.base": "Discount price must be a number",
        "number.min": "Discount price cannot be negative",
      }),
      currency: joi.string().default("VND").messages({
        "string.base": "Currency must be a string",
      }),
      _id: joi.string().optional().allow(""),
    })
    .optional(),
  _id: joi.string().optional().allow(""),
});

// Create product validator
const createProductValidator = joi.object({
  name: joi.string().min(3).max(200).required().messages({
    "string.base": "Product name must be a string",
    "string.min": "Product name must be at least 3 characters long",
    "string.max": "Product name must be at most 200 characters long",
    "any.required": "Product name is required",
  }),
  description: joi.string().min(10).required().messages({
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
  brand: joi.string().allow("").messages({
    "string.base": "Brand must be a string",
  }),
  images: joi.array().items(joi.string().uri()).optional().messages({
    "array.base": "Images must be an array",
    "string.uri": "Each image must be a valid URL",
  }),
  price: priceSchema.required().messages({
    "any.required": "Price is required",
  }),
  variants: joi.array().items(variantSchema).messages({
    "array.base": "Variants must be an array",
  }),
  tags: joi.array().items(joi.string()).messages({
    "array.base": "Tags must be an array",
    "string.base": "Each tag must be a string",
  }),
  isActive: joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean",
  }),
  isNewArrival: joi.boolean().default(false).messages({
    "boolean.base": "isNewArrival must be a boolean",
  }),
  isFeatured: joi.boolean().default(false).messages({
    "boolean.base": "isFeatured must be a boolean",
  }),
  onSale: joi.boolean().default(false).messages({
    "boolean.base": "onSale must be a boolean",
  }),
});

const updateProductValidator = joi
  .object({
    id: joi.string().optional(), // THÊM FIELD ID VÀO VALIDATOR
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
    brand: joi.string().allow("").optional().messages({
      "string.base": "Brand must be a string",
    }),
    images: joi.array().items(joi.string().uri()).optional().messages({
      "array.base": "Images must be an array",
      "string.uri": "Each image must be a valid URL",
    }),
    price: priceSchema.optional().messages({
      "object.base": "Price must be an object",
    }),
    variants: joi.array().items(variantSchema).optional().messages({
      "array.base": "Variants must be an array",
    }),
    tags: joi.array().items(joi.string()).optional().messages({
      "array.base": "Tags must be an array",
      "string.base": "Each tag must be a string",
    }),
    isActive: joi.boolean().truthy("true").falsy("false").optional().messages({
      "boolean.base": "isActive must be a boolean",
    }),
    isNewArrival: joi
      .boolean()
      .truthy("true")
      .falsy("false")
      .optional()
      .messages({
        "boolean.base": "isNewArrival must be a boolean",
      }),
    isFeatured: joi
      .boolean()
      .truthy("true")
      .falsy("false")
      .optional()
      .messages({
        "boolean.base": "isFeatured must be a boolean",
      }),
    onSale: joi.boolean().truthy("true").falsy("false").optional().messages({
      "boolean.base": "onSale must be a boolean",
    }),
  })
  .min(1);

// Add variant validator
const addVariantValidator = joi.object({
  sku: joi.string().required().messages({
    "string.base": "SKU must be a string",
    "any.required": "SKU is required",
  }),
  color: joi.string().allow("").messages({
    "string.base": "Color must be a string",
  }),
  size: joi.string().allow("").messages({
    "string.base": "Size must be a string",
  }),
  stock: joi.number().integer().min(0).default(0).messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
  }),
  images: joi.array().items(joi.string().uri()).messages({
    "array.base": "Images must be an array",
    "string.uri": "Each image must be a valid URL",
  }),
  price: joi
    .alternatives()
    .try(priceSchema, joi.number().positive().required())
    .required()
    .messages({
      "any.required": "Price is required",
      "number.positive": "Price must be positive",
    }),
});

// Update variant validator
const updateVariantValidator = joi.object({
  sku: joi.string().messages({
    "string.base": "SKU must be a string",
  }),
  color: joi.string().allow("").messages({
    "string.base": "Color must be a string",
  }),
  size: joi.string().allow("").messages({
    "string.base": "Size must be a string",
  }),
  stock: joi.number().integer().min(0).messages({
    "number.base": "Stock must be a number",
    "number.integer": "Stock must be an integer",
    "number.min": "Stock cannot be negative",
  }),
  images: joi.array().items(joi.string().uri()).messages({
    "array.base": "Images must be an array",
    "string.uri": "Each image must be a valid URL",
  }),
  price: priceSchema.messages({
    "object.base": "Price must be an object",
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
  search: joi.string().allow("").messages({
    "string.base": "Search must be a string",
  }),
  isActive: joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean",
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
  q: joi.string().required().min(1).messages({
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


