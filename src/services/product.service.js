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

    // Build query - if status is "all", don't filter by status (for seller dashboard)
    const query = status === "all" ? { status: { $ne: "deleted" } } : { status };

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
    let productsQuery = Product.find(query)
      .populate("category", "name slug")
      .populate("shopCategory", "name slug");

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
      .populate("shop", "name logo")
      .populate("shopCategory", "name slug");

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
      .populate("shop", "name logo")
      .populate("shopCategory", "name slug");

    if (!product) {
      throw new Error("Product not found");
    }

    await cacheService.set(cacheKey, product, 3600);
    return product;
  }

  /**
   * Generate SKU from slug and color
   * @param {string} slug - Product slug
   * @param {string} color - Variant color
   * @param {number} index - Variant index
   * @returns {string} Generated SKU
   */
  generateSku(slug, color, index) {
    const slugPart = slug ? slug.substring(0, 20).toUpperCase().replace(/-/g, '') : 'PROD';
    const colorPart = color ? color.substring(0, 10).toUpperCase().replace(/\s+/g, '') : 'DEFAULT';
    return `${slugPart}-${colorPart}-${String(index + 1).padStart(3, '0')}`;
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

    // Generate slug if not provided
    if (!productData.slug && productData.name) {
      const slugify = require('slugify');
      productData.slug = slugify(productData.name, { lower: true, strict: true, locale: 'vi' });
    }

    // Clean up and process variants
    if (productData.variants && Array.isArray(productData.variants)) {
      productData.variants = productData.variants.map((variant, index) => {
        const { _id, attributes, ...rest } = variant;
        
        // Extract color from old attributes structure if present
        const color = variant.color || attributes?.color || '';
        
        // Auto-generate SKU
        const sku = this.generateSku(productData.slug, color, index);
        
        return {
          ...rest,
          color,
          sku,
          // Only keep _id if it's a valid ObjectId (24 hex chars)
          ...(_id && /^[0-9a-fA-F]{24}$/.test(_id) ? { _id } : {})
        };
      });
    }

    // Check if slug already exists
    if (data.slug) {
      const existingProduct = await Product.findOne({ slug: data.slug });
      if (existingProduct) {
        throw new Error("Product with this slug already exists");
      }
    }

    // Handle image files
    if (files && files.length > 0) {
      console.log("[ProductService] Processing files:", files.map(f => ({ fieldname: f.fieldname, size: f.size })));
      
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

      console.log("[ProductService] Upload results:", uploads.map(u => ({ fieldname: u.fieldname, url: u.secure_url?.substring(0, 50) + "..." })));

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

        console.log("[ProductService] Variant image map:", variantImageMap);

        // Assign images to variants
        productData.variants = productData.variants.map((variant, idx) => ({
          ...variant,
          images: [...(variant.images || []), ...(variantImageMap[idx] || [])],
        }));

        console.log("[ProductService] Variants after image assignment:", productData.variants.map(v => ({ name: v.name, images: v.images })));
      }

      // 2. Description Images
      const descImages = uploads.filter((u) => u.fieldname === "descriptionImages");
      if (descImages.length > 0) {
        productData.descriptionImages = descImages.map((u) => u.secure_url);
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
      let newDescriptionImages = [];

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
      if (updateData.existingDescriptionImages !== undefined || newDescriptionImages.length > 0) {
        const existingImages = updateData.existingDescriptionImages 
          ? (Array.isArray(updateData.existingDescriptionImages) 
              ? updateData.existingDescriptionImages 
              : JSON.parse(updateData.existingDescriptionImages))
          : [];
        updateData.descriptionImages = [...existingImages, ...newDescriptionImages];
        delete updateData.existingDescriptionImages;
      }

      // Handle variants update - simple structure with attributes
      if (updateData.variants && Array.isArray(updateData.variants)) {
        // Parse existing variant images if provided
        let existingVariantImagesMap = {};
        if (updateData.existingVariantImages) {
          const mapping = typeof updateData.existingVariantImages === 'string' 
            ? JSON.parse(updateData.existingVariantImages) 
            : updateData.existingVariantImages;
          mapping.forEach(item => {
            existingVariantImagesMap[item.variantIndex] = item.existing || [];
          });
        }
        delete updateData.existingVariantImages;

        updateData.variants = updateData.variants.map((variant, index) => {
          const variantData = { ...variant };
          
          // Remove temp _id - MongoDB will generate real ObjectId
          if (variantData._id && (typeof variantData._id === 'string' && variantData._id.startsWith("temp-"))) {
            delete variantData._id;
          }

          // Combine existing + new uploaded images
          const existingImages = existingVariantImagesMap[index] || variantData.images || [];
          const newImages = variantUploadMap[index] || [];
          variantData.images = [...existingImages, ...newImages];

          return variantData;
        });

        // Update product main images from first variant if needed
        if (updateData.variants[0]?.images?.length > 0) {
          updateData.images = updateData.variants[0].images;
        }
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
    // Skip cache temporarily to ensure fresh data
    // const cacheKey = `products:search:${keyword}:${limit}`;
    // const cachedProducts = await cacheService.get(cacheKey);
    // if (cachedProducts) return cachedProducts;

    const query = {
      status: "published",
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { "category.name": { $regex: keyword, $options: "i" } },
      ],
    };

    const products = await Product.find(query)
      .select("name slug price category variants")
      .populate("category", "name slug")
      .limit(Number(limit))
      .lean();

    // Map products to include first variant image
    const productsWithImages = products.map(product => ({
      ...product,
      image: product.variants?.[0]?.images?.[0] || null,
    }));

    // Skip cache temporarily
    // await cacheService.set(cacheKey, productsWithImages, 600); // 10 mins cache
    return productsWithImages;
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

  /**
   * Update product by seller (with ownership verification)
   * Seller cannot change certain fields like status
   * @param {string} productId - Product ID
   * @param {string} shopId - Shop ID (for verification)
   * @param {Object} data - Data to update
   * @param {Array} [files] - New image files to upload
   * @returns {Promise<Object>} Updated product object
   * @throws {Error} If product not found or not owned by shop
   */
  async updateProductBySeller(productId, shopId, data, files) {
    // Verify ownership
    const existingProduct = await Product.findOne({
      _id: productId,
      shop: shopId,
    });

    if (!existingProduct) {
      throw new Error("Product not found or you don't have permission to update it");
    }

    // Remove fields that seller shouldn't modify
    const updateData = { ...data };
    delete updateData.shop; // Cannot change shop
    delete updateData.status; // Only admin can change status
    delete updateData.soldCount; // System managed
    delete updateData.averageRating; // System managed
    delete updateData.reviewCount; // System managed

    // Use the existing updateProduct method for the actual update
    return this.updateProduct(productId, updateData, files);
  }

  /**
   * Delete product by seller (soft delete with ownership verification)
   * @param {string} productId - Product ID
   * @param {string} shopId - Shop ID (for verification)
   * @returns {Promise<Object>} Deleted product object
   * @throws {Error} If product not found or not owned by shop
   */
  async deleteProductBySeller(productId, shopId) {
    // Verify ownership and soft delete
    const product = await Product.findOneAndUpdate(
      { _id: productId, shop: shopId },
      { 
        isActive: false,
        deletedAt: new Date(),
        deletedBy: 'seller'
      },
      { new: true }
    );

    if (!product) {
      throw new Error("Product not found or you don't have permission to delete it");
    }

    // Invalidate cache
    await cacheService.delByPattern("products:*");

    return product;
  }
}

module.exports = new ProductService();
