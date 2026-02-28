const Product = require("../repositories/product.repository");
const {
  getPaginationParams,
  buildPaginationResponse,
} = require("../utils/pagination");
const Category = require("../repositories/category.repository");
const { multiUpload } = require("../configs/cloudinary");
const { getIO } = require("../socket/index");
const redisService = require("./redis.service");
const logger = require("../utils/logger");
const { buildHashedCacheKey } = require("../utils/cacheKey");
const { embedProduct, deleteProductEmbedding } = require("./embedding.service");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

class ProductService {
  /**
   * Get all products
   * @param {Object} filters
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async getAllProducts(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = "-createdAt",
      category,
      brand,
      minPrice,
      maxPrice,
      tags,
      search,
      status = "published",
      colors,
      sizes,
      rating,
    } = { ...filters, ...options };

    const cacheKey = buildHashedCacheKey("products:all", { filters, options });
    const cachedData = await redisService.get(cacheKey);
    if (cachedData) return cachedData;

    const filterArgs = {
      status,
      category,
      brand,
      shop: filters.shop,
      shopCategory: filters.shopCategory,
      minPrice,
      maxPrice,
      tags,
      search,
      colors,
      sizes,
      rating,
    };

    const total = await Product.countWithCatalogFilters(filterArgs);
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.findWithCatalogFilters(
      filterArgs,
      {
        sort,
        skip: paginationParams.skip,
        limit: paginationParams.limit,
      },
    );

    return buildPaginationResponse(products, paginationParams);
  }

  /**
   * Get product by id
   * @param {string} id
   * @returns {Promise<any>}
   */
  async getProductById(id) {
    const cacheKey = `products:id:${id}`;
    const cachedProduct = await redisService.get(cacheKey);
    if (cachedProduct) return cachedProduct;

    const product = await Product.findByIdWithCategoryShopAndShopCategory(id);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    await redisService.set(cacheKey, product, 3600); // 1 hour cache
    return product;
  }

  /**
   * Get product by slug
   * @param {any} slug
   * @returns {Promise<any>}
   */
  async getProductBySlug(slug) {
    const cacheKey = `products:slug:${slug}`;
    const cachedProduct = await redisService.get(cacheKey);
    if (cachedProduct) return cachedProduct;

    const product = await Product.findBySlugWithCategoryShopAndShopCategory(slug);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    await redisService.set(cacheKey, product, 3600);
    return product;
  }

  /**
   * Generate sku
   * @param {any} slug
   * @param {any} color
   * @param {number} index
   * @returns {string}
   */
  generateSku(slug, color, index) {
    const slugPart = slug
      ? slug.substring(0, 20).toUpperCase().replace(/-/g, "")
      : "PROD";
    const colorPart = color
      ? color.substring(0, 10).toUpperCase().replace(/\s+/g, "")
      : "DEFAULT";
    return `${slugPart}-${colorPart}-${String(index + 1).padStart(3, "0")}`;
  }

  /**
   * Ensure shop for user
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async ensureShopForUser(userId) {
    const User = require("../repositories/user.repository");
    const Shop = require("../repositories/shop.repository");

    const user = await User.findById(userId).lean();
    let shopId = user?.shop;

    if (!shopId) {
      const shop = await Shop.findByOwnerIdLean(userId);
      if (shop) {
        await User.updateById(userId, { shop: shop._id });
        shopId = shop._id;
      }
    }

    if (!shopId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "User does not have a shop. Please register a shop first.",
      );
    }

    return shopId;
  }

  /**
   * Create product
   * @param {Object} data
   * @param {Array} files
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async createProduct(data, files, userId) {
    const shopId = await this.ensureShopForUser(userId);
    const productData = { ...data, shop: shopId };

    // Generate slug if not provided
    if (!productData.slug && productData.name) {
      const slugify = require("slugify");
      productData.slug = slugify(productData.name, {
        lower: true,
        strict: true,
        locale: "vi",
      });
    }

    // Clean up and process variants
    if (productData.variants && Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, index) => {
        const { _id, attributes, ...rest } = variant;

        // Extract color from old attributes structure if present
        const color = variant.color || attributes?.color || "";

        // Auto-generate SKU
        const sku = this.generateSku(productData.slug, color, index);

        return {
          ...rest,
          color,
          sku,
          // Only keep _id if it's a valid ObjectId (24 hex chars)
          ...(_id && /^[0-9a-fA-F]{24}$/.test(_id) ? { _id } : {}),
        };
      });
    }

    // Check if slug already exists
    if (data.slug) {
      const existingProduct = await Product.findBySlug(data.slug);
      if (existingProduct) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          "Product with this slug already exists",
        );
      }
    }

    // Handle image files
    if (files && files.length > 0) {
      logger.info(
        "[ProductService] Processing files:",
        files.map((f) => ({ fieldname: f.fieldname, size: f.size })),
      );

      const filesToUpload = files.map((file) => ({
        buffer: file.buffer,
        fieldname: file.fieldname,
      }));

      const uploadResults = await multiUpload(
        filesToUpload.map((f) => f.buffer),
        "products",
      );

      const uploads = uploadResults.map((result, index) => ({
        ...result,
        fieldname: filesToUpload[index].fieldname,
      }));

      logger.info(
        "[ProductService] Upload results:",
        uploads.map((u) => ({
          fieldname: u.fieldname,
          url: u.secure_url?.substring(0, 50) + "...",
        })),
      );

      // 1. Variant Images (variantImages_0, variantImages_1, etc.)
      // Product images are stored in variants[].images, not product.images
      if (productData.variants && Array.isArray(productData.variants)) {
        const variantImageMap = {};
        uploads.forEach((upload) => {
          if (upload.fieldname.startsWith("variantImages_")) {
            const variantIndex = parseInt(upload.fieldname.split("_")[1]);
            if (!variantImageMap[variantIndex]) {
              variantImageMap[variantIndex] = [];
            }
            variantImageMap[variantIndex].push(upload.secure_url);
          }
        });

        logger.info("[ProductService] Variant image map:", variantImageMap);

        // Assign images to variants
        productData.variants = productData.variants.map((variant, idx) => ({
          ...variant,
          images: [...(variant.images || []), ...(variantImageMap[idx] || [])],
        }));

        logger.info(
          "[ProductService] Variants after image assignment:",
          productData.variants.map((v) => ({ name: v.name, images: v.images })),
        );
      }

      // 2. Description Images
      const descImages = uploads.filter(
        (u) => u.fieldname === "descriptionImages",
      );
      if (descImages.length > 0) {
        productData.descriptionImages = descImages.map((u) => u.secure_url);
      }
    }

    const product = Product.build(productData);
    await product.save();

    await redisService.delByPattern("products:*");

    const io = getIO();
    if (io) {
      io.emit("new_product", {
        name: product.name,
        _id: product._id,
        shop: shopId,
      });
    }

    // Generate embedding for the new product (async, don't wait)
    if (product.status === "published") {
      const populatedProduct = await Product.findByIdWithCategoryNameLean(product._id);
      embedProduct(populatedProduct).catch((err) => {
        logger.error(
          "[ProductService] Error embedding new product:",
          err.message,
        );
      });
    }

    return product;
  }

  /**
   * Update product
   * @param {string} id
   * @param {Object} data
   * @param {Array} files
   * @returns {Promise<any>}
   */
  async updateProduct(id, data, files) {
    try {
      const updateData = { ...data };

      if (updateData.slug) {
        const existingProduct = await Product.findBySlugExcludingId(
          updateData.slug,
          id,
        );
        if (existingProduct) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            "Product with this slug already exists",
          );
        }
      }

      const variantUploadMap = {};
      const newDescriptionImages = [];

      if (files && files.length > 0) {
        const buffers = files.map((file) => file.buffer);
        const uploads = await multiUpload(buffers, "products");

        files.forEach((file, idx) => {
          if (file.fieldname.startsWith("variantImages_")) {
            const variantIndex = parseInt(file.fieldname.split("_")[1]);
            if (!variantUploadMap[variantIndex])
              variantUploadMap[variantIndex] = [];
            variantUploadMap[variantIndex].push(uploads[idx].secure_url);
          } else if (file.fieldname === "descriptionImages") {
            newDescriptionImages.push(uploads[idx].secure_url);
          }
        });
      }

      // Handle description images update
      if (
        updateData.existingDescriptionImages !== undefined ||
        newDescriptionImages.length > 0
      ) {
        const existingImages = updateData.existingDescriptionImages
          ? Array.isArray(updateData.existingDescriptionImages)
            ? updateData.existingDescriptionImages
            : JSON.parse(updateData.existingDescriptionImages)
          : [];
        updateData.descriptionImages = [
          ...existingImages,
          ...newDescriptionImages,
        ];
        delete updateData.existingDescriptionImages;
      }

      // Handle variants update - simple structure with attributes
      if (updateData.variants && Array.isArray(updateData.variants)) {
        // Parse existing variant images if provided
        const existingVariantImagesMap = {};
        if (updateData.existingVariantImages) {
          const mapping =
            typeof updateData.existingVariantImages === "string"
              ? JSON.parse(updateData.existingVariantImages)
              : updateData.existingVariantImages;
          mapping.forEach((item) => {
            existingVariantImagesMap[item.variantIndex] = item.existing || [];
          });
        }
        delete updateData.existingVariantImages;

        updateData.variants = updateData.variants.map((variant, index) => {
          const variantData = { ...variant };

          if (
            variantData._id &&
            typeof variantData._id === "string" &&
            variantData._id.startsWith("temp-")
          ) {
            delete variantData._id;
          }

          const existingImages =
            existingVariantImagesMap[index] || variantData.images || [];
          const newImages = variantUploadMap[index] || [];
          variantData.images = [...existingImages, ...newImages];

          return variantData;
        });

        if (updateData.variants[0]?.images?.length > 0) {
          updateData.images = updateData.variants[0].images;
        }
      }

      const product = await Product.updateByIdWithCategory(id, updateData);

      if (!product) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
      }

      await redisService.delByPattern("products:*");

      if (product.status === "published") {
        const populatedProduct = await Product.findByIdWithCategoryNameLean(product._id);
        embedProduct(populatedProduct).catch((err) => {
          logger.error(
            "[ProductService] Error updating product embedding:",
            err.message,
          );
        });
      } else {
        deleteProductEmbedding(product._id).catch((err) => {
          logger.error(
            "[ProductService] Error deleting product embedding:",
            err.message,
          );
        });
      }

      return product;
    } catch (error) {
      logger.error("Error in updateProduct service:", error);
      throw error;
    }
  }

  /**
   * Delete product
   * @param {string} id
   * @returns {Promise<any>}
   */
  async deleteProduct(id) {
    const product = await Product.updateById(
      id,
      { status: "deleted" },
      { new: true },
    );

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    await redisService.delByPattern("products:*");

    deleteProductEmbedding(id).catch((err) => {
      logger.error(
        "[ProductService] Error deleting product embedding:",
        err.message,
      );
    });

    return product;
  }

  /**
   * Permanent delete product
   * @param {string} id
   * @returns {Promise<any>}
   */
  async permanentDeleteProduct(id) {
    const product = await Product.deleteById(id);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    await redisService.delByPattern("products:*");

    return product;
  }

  /**
   * Add variant
   * @param {string} productId
   * @param {any} variantData
   * @param {Array} files
   * @returns {Promise<any>}
   */
  async addVariant(productId, variantData, files) {
    const allowedVariantData = { ...variantData };

    if (files && files.length > 0) {
      const buffers = files.map((file) => file.buffer);
      const uploads = await multiUpload(buffers, "products");
      allowedVariantData.images = uploads.map((upload) => upload.secure_url);
    } else if (variantData.images) {
      allowedVariantData.images = variantData.images;
    }

    const existingProduct = await Product.findByVariantSku(allowedVariantData.sku);

    if (existingProduct) {
      throw new ApiError(StatusCodes.CONFLICT, "SKU already exists");
    }

    const product = await Product.pushVariant(productId, allowedVariantData);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    return product;
  }

  /**
   * Update variant
   * @param {string} productId
   * @param {string} variantId
   * @param {any} variantData
   * @returns {Promise<any>}
   */
  async updateVariant(productId, variantId, variantData) {
    const allowedVariantData = {
      ...variantData,
      _id: variantId,
    };

    const product = await Product.replaceVariant(
      productId,
      variantId,
      allowedVariantData,
    );

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product or variant not found");
    }

    return product;
  }

  /**
   * Delete variant
   * @param {string} productId
   * @param {string} variantId
   * @returns {Promise<any>}
   */
  async deleteVariant(productId, variantId) {
    const product = await Product.pullVariant(productId, variantId);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    return product;
  }

  /**
   * Get products by category
   * @param {string} categoryId
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async getProductsByCategory(categoryId, options = {}) {
    const { page = 1, limit = 10, sort = "-createdAt" } = options;

    const total = await Product.countByCategory(categoryId);
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.findByCategory(categoryId, {
      sort,
      skip: paginationParams.skip,
      limit: paginationParams.limit,
    });

    return buildPaginationResponse(products, paginationParams);
  }

  /**
   * Get products by category slug
   * @param {any} slug
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async getProductsByCategorySlug(slug, options = {}) {
    const { page = 1, limit = 10, sort = "-createdAt" } = options;

    const category = await Category.findBySlugActive(slug);
    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    const childCategories = await Category.findSubcategoryIds(category._id);

    const categoryIds = [
      category._id,
      ...childCategories.map((child) => child._id),
    ];

    const total = await Product.countByCategoryIds(categoryIds);
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.findByCategoryIds(categoryIds, {
      sort,
      skip: paginationParams.skip,
      limit: paginationParams.limit,
    });

    return {
      ...buildPaginationResponse(products, paginationParams),
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    };
  }

  /**
   * Get featured products simple
   * @param {number} limit
   * @returns {Promise<any>}
   */
  async getFeaturedProductsSimple(limit = 10) {
    const products = await Product.findPublishedNewest(limit);
    if (!products) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Products not found");
    }

    return products;
  }

  /**
   * Get featured products
   * @param {Object} query
   * @returns {Promise<any>}
   */
  async getFeaturedProducts(_query) {
    const cacheKey = "products:featured";
    const cachedProducts = await redisService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const products = await Product.findFeatured(10);

    await redisService.set(cacheKey, products, 1800);
    return products;
  }

  /**
   * Get new arrival products
   * @param {Object} query
   * @returns {Promise<any>}
   */
  async getNewArrivalProducts(_query) {
    const cacheKey = "products:new-arrivals";
    const cachedProducts = await redisService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const products = await Product.findNewArrival(10);

    await redisService.set(cacheKey, products, 1800);
    return products;
  }

  /**
   * Get on sale products
   * @param {Object} query
   * @returns {Promise<any>}
   */
  async getOnSaleProducts(_query) {
    const cacheKey = "products:on-sale";
    const cachedProducts = await redisService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const now = new Date();
    const products = await Product.findOnSale(now, 10);

    await redisService.set(cacheKey, products, 1800);
    return products;
  }

  /**
   * Search products
   * @param {any} keyword
   * @param {number} limit
   * @returns {Promise<any>}
   */
  async searchProducts(keyword, limit = 10) {
    const cacheKey = `products:search:${keyword}:${limit}`;
    const cachedProducts = await redisService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const products = await Product.searchByKeyword(keyword, limit);

    const productsWithImages = products.map((product) => ({
      ...product,
      image: product.variants?.[0]?.images?.[0] || null,
    }));

    await redisService.set(cacheKey, productsWithImages, 300);
    return productsWithImages;
  }

  /**
   * Get related products
   * @param {string} productId
   * @returns {Promise<any>}
   */
  async getRelatedProducts(productId) {
    const limit = 10;
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    const priceBuffer = 0.2;

    const currentPrice = currentProduct.price?.currentPrice || 0;
    const minPrice = currentPrice * (1 - priceBuffer);
    const maxPrice = currentPrice * (1 + priceBuffer);

    const products = await Product.findRelatedByCategoryAndPrice(
      currentProduct,
      { minPrice, maxPrice, limit },
    );

    return products;
  }

  /**
   * Update product by seller
   * @param {string} productId
   * @param {string} shopId
   * @param {Object} data
   * @param {Array} files
   * @returns {Promise<any>}
   */
  async updateProductBySeller(productId, shopId, data, files) {
    const existingProduct = await Product.findByIdAndShop(productId, shopId);

    if (!existingProduct) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Product not found or you don't have permission to update it",
      );
    }

    const updateData = { ...data };
    delete updateData.shop;
    delete updateData.status;
    delete updateData.soldCount;
    delete updateData.averageRating;
    delete updateData.reviewCount;

    return this.updateProduct(productId, updateData, files);
  }

  /**
   * Delete product by seller
   * @param {string} productId
   * @param {string} shopId
   * @returns {Promise<any>}
   */
  async deleteProductBySeller(productId, shopId) {
    const product = await Product.softDeleteByIdAndShop(productId, shopId);

    if (!product) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Product not found or you don't have permission to delete it",
      );
    }

    await redisService.delByPattern("products:*");

    deleteProductEmbedding(productId).catch((err) => {
      logger.error(
        "[ProductService] Error deleting product embedding:",
        err.message,
      );
    });

    return product;
  }

  /**
   * Add variant by seller
   * @param {string} productId
   * @param {string} shopId
   * @param {any} variantData
   * @param {Array} files
   * @returns {Promise<any>}
   */
  async addVariantBySeller(productId, shopId, variantData, files) {
    const product = await Product.findByIdAndShop(productId, shopId);
    if (!product) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Product not found or access denied",
      );
    }
    return this.addVariant(productId, variantData, files);
  }

  /**
   * Update variant by seller
   * @param {string} productId
   * @param {string} shopId
   * @param {string} variantId
   * @param {any} variantData
   * @returns {Promise<any>}
   */
  async updateVariantBySeller(productId, shopId, variantId, variantData) {
    const product = await Product.findByIdAndShop(productId, shopId);
    if (!product) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Product not found or access denied",
      );
    }
    return this.updateVariant(productId, variantId, variantData);
  }

  /**
   * Delete variant by seller
   * @param {string} productId
   * @param {string} shopId
   * @param {string} variantId
   * @returns {Promise<any>}
   */
  async deleteVariantBySeller(productId, shopId, variantId) {
    const product = await Product.findByIdAndShop(productId, shopId);
    if (!product) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Product not found or access denied",
      );
    }
    return this.deleteVariant(productId, variantId);
  }
}

module.exports = new ProductService();


