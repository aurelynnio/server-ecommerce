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
   * @param {boolean} [filters.isActive=true] - Filter by active status
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
      isActive = true,
      colors,
      sizes,
      rating,
    } = { ...filters, ...options };

    // Redis Cache Key
    const cacheKey = `products:all:${JSON.stringify({ filters, options })}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return cachedData;

    // Build query
    console.log("getAllProducts Filters:", { filters, options });
    const query = { isActive };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by brand
    if (brand) {
      query.brand = brand;
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

    console.log("Built Query:", JSON.stringify(query, null, 2));

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
      .populate("reviews");

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.set(cacheKey, product, 3600); // 1 hour cache
    return product;
  }

  async getProductBySlug(slug) {
    const cacheKey = `products:slug:${slug}`;
    const cachedProduct = await cacheService.get(cacheKey);
    if (cachedProduct) return cachedProduct;

    const product = await Product.findOne({ slug })
      .populate("category", "name slug")
      .populate("reviews");

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.set(cacheKey, product, 3600);
    return product;
  }
  // Create new product
  async createProduct(data, files) {
    // Use data directly as it's already validated
    const productData = { ...data };

    // Check if slug already exists
    if (data.slug) {
      const existingProduct = await Product.findOne({ slug: data.slug });
      if (existingProduct) {
        throw new Error("Product with this slug already exists");
      }
    }

    // Handle image files
    if (files && files.length > 0) {
      // Collect all buffers to upload
      const filesToUpload = files.map((file) => ({
        buffer: file.buffer,
        fieldname: file.fieldname,
      }));

      // Upload all files concurrently
      const uploadResults = await multiUpload(
        filesToUpload.map((f) => f.buffer),
        "products"
      );

      // Map uploads back to their original fields
      const uploads = uploadResults.map((result, index) => ({
        ...result,
        fieldname: filesToUpload[index].fieldname,
      }));

      // Process main product images
      const mainImages = uploads.filter((u) => u.fieldname === "images");
      if (mainImages.length > 0) {
        productData.images = mainImages.map((u) => u.secure_url);
      }

      // Process variant images
      if (productData.variants && Array.isArray(productData.variants)) {
        productData.variants = productData.variants.map((variant, index) => {
          const variantImages = uploads.filter(
            (u) => u.fieldname === `variantImages_${index}`
          );
          if (variantImages.length > 0) {
            return {
              ...variant,
              images: variantImages.map((u) => u.secure_url),
            };
          }
          return variant;
        });
      }
    }

    const product = new Product(productData);
    await product.save();

    // Invalidate cache
    await cacheService.delByPattern("products:*");

    // Emit socket event
    const io = getIO();
    if (io) {
      io.emit("new_product", {
        name: product.name,
        _id: product._id,
      });
    }

    return product;
  }

  // Update product
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

      let newImages = [];
      const variantUploadMap = {};

      if (files && files.length > 0) {
        const buffers = files.map((file) => file.buffer);
        const uploads = await multiUpload(buffers, "products");

        files.forEach((file, idx) => {
          if (file.fieldname === "images") {
            newImages.push(uploads[idx].secure_url);
          } else if (file.fieldname.startsWith("variantImages_")) {
            const variantIndex = parseInt(file.fieldname.split("_")[1]);
            if (!variantUploadMap[variantIndex])
              variantUploadMap[variantIndex] = [];
            variantUploadMap[variantIndex].push(uploads[idx].secure_url);
          }
        });
      }

      let currentImages = data.existingImages || [];

      if (data.existingImages || (files && files.length > 0)) {
        if (currentImages.length > 0 || newImages.length > 0) {
          updateData.images = [...currentImages, ...newImages];
        }
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

  // Delete product (soft delete)
  async deleteProduct(id) {
    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.delByPattern("products:*");

    return product;
  }

  // Permanently delete product
  async permanentDeleteProduct(id) {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.delByPattern("products:*");

    return product;
  }

  // Add variant to product
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

  // Update variant
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

  // Delete variant
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

  // Get products by category
  async getProductsByCategory(categoryId, options = {}) {
    const { page = 1, limit = 10, sort = "-createdAt" } = options;

    const query = {
      category: categoryId,
      isActive: true,
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

  // Get products by category slug
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
      isActive: true,
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

  // Get featured products (based on sales count)
  async getFeaturedProductsSimple(limit = 10) {
    const products = await Product.find({ isActive: true })
      .populate("category", "name slug")
      .sort("-createdAt")
      .limit(Number(limit))
      .lean();
    if (!products) {
      throw new Error("Products not found");
    }

    return products;
  }

  // Get featured products (simple - 10 items only)
  async getFeaturedProducts(query) {
    const cacheKey = "products:featured";
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const filter = {
      isActive: true,
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

  // Get new arrival products (simple - 10 items only)
  async getNewArrivalProducts(query) {
    const cacheKey = "products:new-arrivals";
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const filter = {
      isActive: true,
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

  // Get products on sale (simple - 10 items only)
  async getOnSaleProducts(query) {
    const cacheKey = "products:on-sale";
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const filter = {
      isActive: true,
      onSale: true,
      "price.discountPrice": { $ne: null },
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    await cacheService.set(cacheKey, products, 1800);
    return products;
  }
  // Search products (optimized for search bar/autocomplete)
  async searchProducts(keyword, limit = 10) {
    const cacheKey = `products:search:${keyword}:${limit}`;
    const cachedProducts = await cacheService.get(cacheKey);
    if (cachedProducts) return cachedProducts;

    const query = {
      isActive: true,
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

  // Get related products
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
      isActive: true,
      "price.currentPrice": { $gte: minPrice, $lte: maxPrice },
    };

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return products;
  }
  // Delete variant
  async deleteVariant(productId, variantId) {
    const product = await Product.findByIdAndUpdate(
      productId,
      {
        $pull: { variants: { _id: variantId } },
      },
      { new: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }
}

module.exports = new ProductService();
