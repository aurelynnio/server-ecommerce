const Product = require("../models/product.model");
const {
  getPaginationParams,
  buildPaginationResponse,
} = require("../utils/pagination");
const Category = require("../models/category.model");
const Review = require("../models/review.model");
const { multiUpload } = require("../configs/cloudinary");
const { getIO } = require("../socket/index");
const cacheService = require("./cache.service");

/**
 * Service handling product operations
 * Manages product retrieval, filtering, and search
 */
class ProductService {
  /**
   * Get all products with advanced filtering, sorting, and pagination
   * @param {Object} filters - Filter criteria
   * @param {string} [filters.category] - Filter by category ID
   * @param {string} [filters.brand] - Filter by brand
   * @param {number} [filters.minPrice] - Minimum price
   * @param {number} [filters.maxPrice] - Maximum price
   * @param {string|string[]} [filters.tags] - Filter by tags
   * @param {string} [filters.search] - Search term
   * @param {string} [filters.status="published"] - Filter by status
   * @param {Object} options - Pagination and sorting options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @param {string} [options.sort="-createdAt"] - Sort field
   * @returns {Promise<Object>} List of products with pagination metadata
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

    // Redis Cache Key
    const cacheKey = `products:all:${JSON.stringify({ filters, options })}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return cachedData;

    // Build query
    const query = { status };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by brand
    if (brand) {
      query.brand = brand;
    }

    // Filter by Shop
    if (filters.shop) {
      query.shop = filters.shop;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query["price.currentPrice"] = {};
      if (minPrice) query["price.currentPrice"].$gte = Number(minPrice);
      if (maxPrice) query["price.currentPrice"].$lte = Number(maxPrice);
    }

    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(",");
      query.tags = { $in: tagArray };
    }

    // Filter by colors
    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(",");
      // Using regex for case-insensitive matching
      const colorRegexArray = colorArray.map((c) => new RegExp(`^${c}$`, "i"));
      query["variants.color"] = { $in: colorRegexArray };
    }

    // Filter by sizes
    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(",");
      query["variants.size"] = { $in: sizeArray };
    }

    // Filter by rating
    if (rating) {
      const ratingArray = Array.isArray(rating)
        ? rating
        : rating.split(",").map(Number);
      const minRating = Math.min(...ratingArray);
      if (!isNaN(minRating)) {
        query.averageRating = { $gte: minRating };
      }
    }

    // Search by name, description, or brand using Text Index
    if (search) {
      query.$text = { $search: search };
    }

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    // Calculate pagination parameters
    const paginationParams = getPaginationParams(page, limit, total);

    // Execute query
    let productsQuery = Product.find(query).populate("category", "name slug");

    // If searching, sort by relevance score
    if (search) {
      productsQuery = productsQuery
        .select({ score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } });
    } else {
      productsQuery = productsQuery.sort(sort);
    }

    const products = await productsQuery
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return {
      data: products,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalItems: paginationParams.totalItems,
        totalPages: paginationParams.totalPages,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  /**
   * Get single product by ID
   * @param {string} id - Product ID
   * @returns {Promise<Object>} Product object with populated fields
   * @throws {Error} If product not found
   */
  async getProductById(id) {
    const cacheKey = `products:id:${id}`;
    const cachedProduct = await cacheService.get(cacheKey);
    if (cachedProduct) return cachedProduct;

    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("shop", "name logo");

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.set(cacheKey, product, 3600); // 1 hour cache
    return product;
  }

  /**
   * Get single product by slug
   * @param {string} slug - Product slug
   * @returns {Promise<Object>} Product object with populated fields
   * @throws {Error} If product not found
   */
  async getProductBySlug(slug) {
    const cacheKey = `products:slug:${slug}`;
    const cachedProduct = await cacheService.get(cacheKey);
    if (cachedProduct) return cachedProduct;

    const product = await Product.findOne({ slug })
      .populate("category", "name slug")
      .populate("shop", "name logo");

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.set(cacheKey, product, 3600);
    return product;
  }

  /**
   * Create a new product
   * @param {Object} data - Product data
   * @param {string} data.name - Product name
   * @param {string} [data.slug] - Product slug (optional)
   * @param {Object} data.price - Price information
   * @param {Array} [files] - Image files to upload
   * @param {string} shopId - Shop ID creating the product
   * @returns {Promise<Object>} Created product object
   * @throws {Error} If slug already exists
   */
  async createProduct(data, files, shopId) {
    const productData = { ...data, shop: shopId };

    // Check if slug already exists
    if (data.slug) {
      const existingProduct = await Product.findOne({ slug: data.slug });
      if (existingProduct) {
        throw new Error("Product with this slug already exists");
      }
    }

    // Handle image files
    if (files && files.length > 0) {
      const filesToUpload = files.map((file) => ({
        buffer: file.buffer,
        fieldname: file.fieldname,
      }));

      const uploadResults = await multiUpload(
        filesToUpload.map((f) => f.buffer),
        "products"
      );

      const uploads = uploadResults.map((result, index) => ({
        ...result,
        fieldname: filesToUpload[index].fieldname,
      }));

      // 1. Main Product Images
      const mainImages = uploads.filter((u) => u.fieldname === "images");
      if (mainImages.length > 0) {
        productData.images = mainImages.map((u) => u.secure_url);
      }

      // 2. Tier Variation Images
      // Expect fieldname: "tierImages_0", "tierImages_1" (index of tierVariation)
      if (
        productData.tierVariations &&
        Array.isArray(productData.tierVariations)
      ) {
        productData.tierVariations = productData.tierVariations.map(
          (tier, tIndex) => {
            // For each option in this tier, we might have images?
            // Taobao usually has images for the first tier (e.g. Color).
            // Simple implementation: "tierImages_{tIndex}" maps to the options of that tier
            // This part depends heavily on how Frontend sends data.
            // Assuming parsed data or simple image array mapping for key property.
            return tier;
          }
        );
      }
    }

    const product = new Product(productData);
    await product.save();

    await cacheService.delByPattern("products:*");

    const io = getIO();
    if (io) {
      io.emit("new_product", {
        name: product.name,
        _id: product._id,
        shop: shopId,
      });
    }

    return product;
  }

  /**
   * Update an existing product
   * @param {string} id - Product ID
   * @param {Object} data - Data to update
   * @param {Array} [files] - New image files to upload
   * @returns {Promise<Object>} Updated product object
   * @throws {Error} If product not found or slug already exists
   */
  async updateProduct(id, data, files) {
    try {
      const updateData = { ...data };

      if (updateData.slug) {
        const existingProduct = await Product.findOne({
          slug: updateData.slug,
          _id: { $ne: id },
        });
        if (existingProduct) {
          throw new Error("Product with this slug already exists");
        }
      }

      let variantUploadMap = {};

      if (files && files.length > 0) {
        const buffers = files.map((file) => file.buffer);
        const uploads = await multiUpload(buffers, "products");

        files.forEach((file, idx) => {
          if (file.fieldname.startsWith("variantImages_")) {
            const variantIndex = parseInt(file.fieldname.split("_")[1]);
            if (!variantUploadMap[variantIndex])
              variantUploadMap[variantIndex] = [];
            variantUploadMap[variantIndex].push(uploads[idx].secure_url);
          }
        });
      }

      if (updateData.variants && Array.isArray(updateData.variants)) {
        updateData.variants = updateData.variants.map((variant, index) => {
          const variantData = { ...variant };
          if (variantData._id && variantData._id.startsWith("temp-")) {
            delete variantData._id;
          }

          if (variantUploadMap[index]) {
            const existingVariantImages = variantData.images || [];
            variantData.images = [
              ...existingVariantImages,
              ...variantUploadMap[index],
            ];
          }
          return variantData;
        });
      }

      const product = await Product.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate("category", "name slug");

      if (!product) {
        throw new Error("Product not found");
      }

      // Invalidate cache
      await cacheService.delByPattern("products:*");

      return product;
    } catch (error) {
      console.error("Error in updateProduct service:", error);
      throw error;
    }
  }

  /**
   * Soft delete a product (sets status to "deleted")
   * @param {string} id - Product ID
   * @returns {Promise<Object>} Deleted product object
   * @throws {Error} If product not found
   */
  async deleteProduct(id) {
    const product = await Product.findByIdAndUpdate(
      id,
      { status: "deleted" },
      { new: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.delByPattern("products:*");

    return product;
  }

  /**
   * Permanently delete a product from database
   * @param {string} id - Product ID
   * @returns {Promise<Object>} Deleted product object
   * @throws {Error} If product not found
   */
  async permanentDeleteProduct(id) {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.delByPattern("products:*");

    return product;
  }

  /**
   * Add a new variant to a product
   * @param {string} productId - Product ID
   * @param {Object} variantData - Variant details (sku, color, size, price, stock)
   * @param {Array} [files] - Variant image files
   * @returns {Promise<Object>} Updated product with new variant
   * @throws {Error} If product not found or SKU already exists
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

    const existingProduct = await Product.findOne({
      "variants.sku": allowedVariantData.sku,
    });

    if (existingProduct) {
      throw new Error("SKU already exists");
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { $push: { variants: allowedVariantData } },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  /**
   * Update an existing variant
   * @param {string} productId - Product ID
   * @param {string} variantId - Variant ID
   * @param {Object} variantData - Data to update
   * @returns {Promise<Object>} Updated product
   * @throws {Error} If product or variant not found
   */
  async updateVariant(productId, variantId, variantData) {
    const allowedVariantData = {
      ...variantData,
      _id: variantId,
    };

    const product = await Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId },
      { $set: { "variants.$": allowedVariantData } },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new Error("Product or variant not found");
    }

    return product;
  }

  /**
   * Delete a variant from a product
   * @param {string} productId - Product ID
   * @param {string} variantId - Variant ID to delete
   * @returns {Promise<Object>} Updated product
   * @throws {Error} If product not found
   */
  async deleteVariant(productId, variantId) {
    const product = await Product.findByIdAndUpdate(
      productId,
      { $pull: { variants: { _id: variantId } } },
      { new: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  /**
   * Get products by category ID
   * @param {string} categoryId - Category ID
   * @param {Object} [options] - Pagination and sorting options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @param {string} [options.sort="-createdAt"] - Sort field
   * @returns {Promise<Object>} Products with pagination metadata
   */
  async getProductsByCategory(categoryId, options = {}) {
    const { page = 1, limit = 10, sort = "-createdAt" } = options;

    const query = {
      category: categoryId,
      status: "published",
    };

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    // Calculate pagination parameters
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort(sort)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return {
      data: products,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalItems: paginationParams.totalItems,
        totalPages: paginationParams.totalPages,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  /**
   * Get products by category slug (includes child categories)
   * @param {string} slug - Category slug
   * @param {Object} [options] - Pagination and sorting options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @param {string} [options.sort="-createdAt"] - Sort field
   * @returns {Promise<Object>} Products with category info and pagination
   * @throws {Error} If category not found
   */
  async getProductsByCategorySlug(slug, options = {}) {
    const { page = 1, limit = 10, sort = "-createdAt" } = options;

    // First, find the category by slug
    const category = await Category.findOne({ slug, isActive: true });
    if (!category) {
      throw new Error("Category not found");
    }

    // Get all child categories as well
    const childCategories = await Category.find({
      parentCategory: category._id,
      isActive: true,
    }).select("_id");

    // Create array of category IDs (parent + children)
    const categoryIds = [
      category._id,
      ...childCategories.map((child) => child._id),
    ];

    const query = {
      category: { $in: categoryIds },
      status: "published",
    };

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    // Calculate pagination parameters
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort(sort)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return {
      data: products,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalItems: paginationParams.totalItems,
        totalPages: paginationParams.totalPages,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  /**
   * Get featured products (simple version, sorted by creation date)
   * @param {number} [limit=10] - Maximum number of products to return
   * @returns {Promise<Array>} List of featured products
   * @throws {Error} If no products found
   */
  async getFeaturedProductsSimple(limit = 10) {
    const products = await Product.find({ status: "published" })
      .populate("category", "name slug")
      .sort("-createdAt")
      .limit(Number(limit))
      .lean();
    if (!products) {
      throw new Error("Products not found");
    }

    return products;
  }

  /**
   * Get featured products (with caching)
   * @param {Object} [query] - Query parameters (unused, for API compatibility)
   * @returns {Promise<Array>} List of featured products (max 10)
   */
  async getFeaturedProducts(query) {
    const cacheKey = "products:featured";
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const filter = {
      status: "published",
      isFeatured: true,
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    await cacheService.set(cacheKey, products, 1800); // 30 mins cache
    return products;
  }

  /**
   * Get new arrival products (with caching)
   * @param {Object} [query] - Query parameters (unused, for API compatibility)
   * @returns {Promise<Array>} List of new arrival products (max 10)
   */
  async getNewArrivalProducts(query) {
    const cacheKey = "products:new-arrivals";
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const filter = {
      status: "published",
      isNewArrival: true,
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    await cacheService.set(cacheKey, products, 1800);
    return products;
  }

  /**
   * Get products currently on sale (with caching)
   * Uses virtual onSale field or checks discountPrice/flashSale
   * @param {Object} [query] - Query parameters (unused, for API compatibility)
   * @returns {Promise<Array>} List of on-sale products (max 10)
   */
  async getOnSaleProducts(query) {
    const cacheKey = "products:on-sale";
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const now = new Date();
    const filter = {
      status: "published",
      $or: [
        { "price.discountPrice": { $ne: null, $gt: 0 } },
        { 
          "flashSale.isActive": true,
          "flashSale.startTime": { $lte: now },
          "flashSale.endTime": { $gt: now }
        }
      ],
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    await cacheService.set(cacheKey, products, 1800);
    return products;
  }

  /**
   * Search products by keyword (optimized for autocomplete)
   * @param {string} keyword - Search keyword
   * @param {number} [limit=10] - Maximum results to return
   * @returns {Promise<Array>} Matching products with basic info
   */
  async searchProducts(keyword, limit = 10) {
    const cacheKey = `products:search:${keyword}:${limit}`;
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const query = {
      status: "published",
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { "category.name": { $regex: keyword, $options: "i" } },
      ],
    };

    const products = await Product.find(query)
      .select("name slug images price category")
      .populate("category", "name slug")
      .limit(Number(limit))
      .lean();

    await cacheService.set(cacheKey, products, 600); // 10 mins cache
    return products;
  }

  /**
   * Get related products based on category and price range
   * @param {string} productId - Current product ID
   * @returns {Promise<Array>} List of related products (max 10)
   * @throws {Error} If product not found
   */
  async getRelatedProducts(productId) {
    const limit = 10;
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      throw new Error("Product not found");
    }

    const priceBuffer = 0.2; // 20% price difference
    const currentPrice = currentProduct.price?.currentPrice || 0;
    const minPrice = currentPrice * (1 - priceBuffer);
    const maxPrice = currentPrice * (1 + priceBuffer);

    const query = {
      _id: { $ne: currentProduct._id },
      category: currentProduct.category,
      status: "published",
      "price.currentPrice": { $gte: minPrice, $lte: maxPrice },
    };

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return products;
  }
}

module.exports = new ProductService();
