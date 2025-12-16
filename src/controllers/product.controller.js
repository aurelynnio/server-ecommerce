const catchAsync = require("../configs/catchAsync");
const productService = require("../services/product.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const {
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
} = require("../validations/product.validator");


const ProductController = {
  // Get all products with filters
  getAllProducts: catchAsync(async (req, res) => {
    // Validate query params
    const { error, value } = getProductsQueryValidator.validate(req.query, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const result = await productService.getAllProducts(value);
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get single product by ID
  getProductById: catchAsync(async (req, res) => {
    // Validate params
    const { error, value } = mongoIdParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const product = await productService.getProductById(value.id);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get single product by slug
  getProductBySlug: catchAsync(async (req, res) => {
    // Validate params
    const { error, value } = slugParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const product = await productService.getProductBySlug(value.slug);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Create new product
  createProduct: catchAsync(async (req, res) => {
    // Parse form data to product data
    let productData = {};

    // Handle text fields from form data
    if (req.body.name) productData.name = req.body.name;
    if (req.body.description) productData.description = req.body.description;
    if (req.body.slug) productData.slug = req.body.slug;
    if (req.body.category) productData.category = req.body.category;
    if (req.body.brand) productData.brand = req.body.brand;
    if (req.body.isActive !== undefined) {
      productData.isActive =
        req.body.isActive === "true" || req.body.isActive === true;
    }
    if (req.body.isNewArrival !== undefined) {
      productData.isNewArrival =
        req.body.isNewArrival === "true" || req.body.isNewArrival === true;
    }
    if (req.body.isFeatured !== undefined) {
      productData.isFeatured =
        req.body.isFeatured === "true" || req.body.isFeatured === true;
    }
    if (req.body.onSale !== undefined) {
      productData.onSale =
        req.body.onSale === "true" || req.body.onSale === true;
    }

    // Handle price object - must be sent as JSON string
    if (req.body.price) {
      try {
        productData.price = JSON.parse(req.body.price);
      } catch (error) {
        return sendFail(
          res,
          "Price must be a valid JSON object with currentPrice, discountPrice, and currency",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    if (req.body.variants) {
      try {
        productData.variants = JSON.parse(req.body.variants);
      } catch (error) {
        return sendFail(
          res,
          "Variants must be a valid JSON array",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Handle tags array - optional, must be sent as JSON string if provided
    if (req.body.tags) {
      try {
        productData.tags = JSON.parse(req.body.tags);
      } catch (error) {
        return sendFail(
          res,
          "Tags must be a valid JSON array",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Validate product data
    const { error, value } = createProductValidator.validate(productData, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    // Pass value (validated data) and req.files to service
    const product = await productService.createProduct(value, req.files);
    return sendSuccess(
      res,
      product,
      "Product created successfully",
      StatusCodes.CREATED
    );
  }),

  // Trong controller, thêm debug cho validator error
  updateProduct: catchAsync(async (req, res) => {
    // Parse JSON fields if they are strings (from FormData)
    if (req.body) {
      ["price", "variants", "tags"].forEach((field) => {
        if (typeof req.body[field] === "string") {
          try {
            req.body[field] = JSON.parse(req.body[field]);
          } catch (e) {
            console.error(`Failed to parse ${field}:`, e);
          }
        }
      });

      // Handle existing images (if sent as JSON string)
      let currentImages = [];
      if (req.body.existingImages) {
        try {
          currentImages =
            typeof req.body.existingImages === "string"
              ? JSON.parse(req.body.existingImages)
              : req.body.existingImages;
        } catch (error) {
          return sendFail(
            res,
            "Existing images must be a valid JSON array",
            StatusCodes.BAD_REQUEST
          );
        }
      }

      // Handle new image files logic moved to service
      // if (req.files && req.files.length > 0) ...

      // Remove existingImages from body to avoid validation error ?? 
      // Actually service needs existingImages. Joi probably allows it if we parsed it.
      // We keep it in body for Service.
    }

    // Validate request body
    console.log(`Check req.body in controller: ${JSON.stringify(req.body)}`);
    const { error, value } = updateProductValidator.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => {
        console.log(
          `Field: ${detail.path}, Message: ${detail.message}, Value: ${detail.context?.value}`
        );
        return detail.message;
      });
      console.log("=== END VALIDATION ERROR ===");
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    console.log("Validated value:", value);

    const { id } = req.params;
    // Pass validation result (data) and req.files to service
    const product = await productService.updateProduct(id, value, req.files);
    return sendSuccess(
      res,
      product,
      "Product updated successfully",
      StatusCodes.OK
    );
  }),

  // Delete product (soft delete)
  deleteProduct: catchAsync(async (req, res) => {
    // Validate params
    const { error, value } = mongoIdParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const product = await productService.deleteProduct(value.id);
    return sendSuccess(
      res,
      product,
      "Product deleted successfully",
      StatusCodes.OK
    );
  }),

  // Permanently delete product
  permanentDeleteProduct: catchAsync(async (req, res) => {
    // Validate params
    const { error, value } = mongoIdParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    await productService.permanentDeleteProduct(value.id);
    return sendSuccess(
      res,
      null,
      "Product permanently deleted",
      StatusCodes.OK
    );
  }),

  // Add variant to product
  addVariant: catchAsync(async (req, res) => {
    const { id } = req.params;

    // Parse JSON data from form data (all text fields come as strings)
    let variantData = {};
    console.log(`Check req.body ${JSON.stringify(req.body)}`);
    // console.log(`Check req.files ${JSON.stringify(req.files)}`);

    // Handle text fields from form data
    if (req.body.color) variantData.color = req.body.color;
    if (req.body.size) variantData.size = req.body.size;
    if (req.body.stock) variantData.stock = parseInt(req.body.stock);
    if (req.body.sku) variantData.sku = req.body.sku;

    // Handle price object - must be sent as JSON string in form data
    if (req.body.price) {
      try {
        variantData.price = JSON.parse(req.body.price);
      } catch (error) {
        return sendFail(
          res,
          "Price must be a valid JSON object with currentPrice, discountPrice, and currency",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Handle image files from form data is now in service
    // if (req.files && req.files.length > 0) ...
            
    // Validate variant data
    const { error, value } = addVariantValidator.validate(variantData, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    // Pass logic to service with files
    const product = await productService.addVariant(id, value, req.files);
    return sendSuccess(
      res,
      product,
      "Variant added successfully",
      StatusCodes.CREATED
    );
  }),

  // Update variant
  updateVariant: catchAsync(async (req, res) => {
    // Validate request body
    const { error, value } = updateVariantValidator.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const { id, variantId } = req.params;
    const product = await productService.updateVariant(id, variantId, value);
    return sendSuccess(
      res,
      product,
      "Variant updated successfully",
      StatusCodes.OK
    );
  }),

  // Delete variant
  deleteVariant: catchAsync(async (req, res) => {
    // Validate params
    const { error, value } = variantIdsParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const product = await productService.deleteVariant(
      value.id,
      value.variantId
    );
    return sendSuccess(
      res,
      product,
      "Variant deleted successfully",
      StatusCodes.OK
    );
  }),

  // Get products by category
  getProductsByCategory: catchAsync(async (req, res) => {
    // Validate params
    const paramError = categoryIdParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (paramError.error) {
      const errors = paramError.error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    // Validate query
    const queryError = paginationQueryValidator.validate(req.query, {
      abortEarly: false,
    });

    if (queryError.error) {
      const errors = queryError.error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const result = await productService.getProductsByCategory(
      paramError.value.categoryId,
      queryError.value
    );
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get products by category slug
  getProductsByCategorySlug: catchAsync(async (req, res) => {
    // Validate params
    const paramError = categorySlugParamValidator.validate(req.params, {
      abortEarly: false,
    });

    if (paramError.error) {
      const errors = paramError.error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    // Validate query
    const queryError = paginationQueryValidator.validate(req.query, {
      abortEarly: false,
    });

    if (queryError.error) {
      const errors = queryError.error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const result = await productService.getProductsByCategorySlug(
      paramError.value.slug,
      queryError.value
    );
    return sendSuccess(
      res,
      result,
      "Products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get featured products
  getFeaturedProducts: catchAsync(async (req, res) => {
    // Validate query
    const { error, value } = limitQueryValidator.validate(req.query, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const products = await productService.getFeaturedProductsSimple(
      value.limit
    );
    return sendSuccess(
      res,
      products,
      "Featured products retrieved successfully",
      StatusCodes.OK
    );
  }),



  // Get new arrival products (simple - 10 items only)
  getNewArrivalProducts: catchAsync(async (req, res) => {
    const result = await productService.getNewArrivalProducts();
    return sendSuccess(
      res,
      result,
      "New arrival products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get products on sale (simple - 10 items only)
  getOnSaleProducts: catchAsync(async (req, res) => {
    const result = await productService.getOnSaleProducts();
    return sendSuccess(
      res,
      result,
      "On sale products retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Search products
  searchProducts: catchAsync(async (req, res) => {
    // Validate query
    const { error, value } = searchQueryValidator.validate(req.query, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return sendFail(res, errors.join(", "), StatusCodes.BAD_REQUEST);
    }

    const result = await productService.searchProducts(value.q, value.limit);
    return sendSuccess(
      res,
      result,
      "Products found successfully",
      StatusCodes.OK
    );
  }),

  // Get related products
  getRelatedProducts: catchAsync(async (req, res) => {
    const { id } = req.params;

    const result = await productService.getRelatedProducts(id);

    return sendSuccess(
      res,
      result,
      "Related products retrieved successfully",
      StatusCodes.OK
    );
  }),
  // Delete variant
  deleteVariant: catchAsync(async (req, res) => {
    const { id, variantId } = req.params;

    const result = await productService.deleteVariant(id, variantId);

    return sendSuccess(
      res,
      result,
      "Variant deleted successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = ProductController;
