const Product = require("../models/product.model");
const {
  getPaginationParams,
  buildPaginationResponse,
} = require("../utils/pagination");
const Category = require("../models/category.model");
const Review = require("../models/review.model");
const { multiUpload } = require("../configs/cloudinary");

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
    } = { ...filters, ...options };

    // Build query
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
    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("reviews");

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  async getProductBySlug(slug) {
    const product = await Product.findOne({ slug })
      .populate("category", "name slug")
      .populate("reviews");

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }
  // Create new product
  async createProduct(data, files) {
    // Only allow specific fields
    const allowedData = {
      name: data.name,
      description: data.description,
      slug: data.slug,
      category: data.category,
      brand: data.brand,
      price: data.price,
      variants: data.variants,
      tags: data.tags,
      isActive: data.isActive,
      isNewArrival: data.isNewArrival,
      isFeatured: data.isFeatured,
      onSale: data.onSale,
    };

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
            fieldname: file.fieldname
        }));
        
        // Upload all files concurrently
        const uploadResults = await multiUpload(filesToUpload.map(f => f.buffer));
        
        // Map uploads back to their original fields
        const uploads = uploadResults.map((result, index) => ({
            ...result,
            fieldname: filesToUpload[index].fieldname
        }));

        // Process main product images
        const mainImages = uploads.filter(u => u.fieldname === "images");
        if(mainImages.length > 0) {
             allowedData.images = mainImages.map(u => u.secure_url);
        }

        // Process variant images
        if (allowedData.variants && Array.isArray(allowedData.variants)) {
            allowedData.variants = allowedData.variants.map((variant, index) => {
                const variantImages = uploads.filter(u => u.fieldname === `variantImages_${index}`);
                if (variantImages.length > 0) {
                     return { ...variant, images: variantImages.map(u => u.secure_url) };
                }
                return variant;
            });
        }
    }

    const product = new Product(allowedData);
    await product.save();

    return product;
  }

  // Update product
  async updateProduct(id, data, files) {
    try {
      // Only allow specific fields
      const allowedData = {};
      const allowedFields = [
        "name",
        "description",
        "slug",
        "category",
        "brand",
        "images",
        "price",
        "variants",
        "tags",
        "isActive",
        "isNewArrival",
        "isFeatured",
        "onSale",
      ];

      // Filter only allowed fields
      allowedFields.forEach((field) => {
        if (data[field] !== undefined) {
          allowedData[field] = data[field];
        }
      });

      // Handle boolean fields from string to boolean (often needed for FormData)
      const booleanFields = [
        "isActive",
        "isNewArrival",
        "isFeatured",
        "onSale",
      ];
      booleanFields.forEach((field) => {
        if (allowedData[field] !== undefined) {
          if (typeof allowedData[field] === "string") {
            allowedData[field] = allowedData[field] === "true";
          }
        }
      });

      if (allowedData.slug) {
        const existingProduct = await Product.findOne({
          slug: allowedData.slug,
          _id: { $ne: id },
        });
        if (existingProduct) {
          throw new Error("Product with this slug already exists");
        }
      }

      // Handle file uploads
      let newImages = [];
      const variantUploadMap = {}; // { index: [urls] }

      if (files && files.length > 0) {
          const buffers = files.map((file) => file.buffer);
          const uploads = await multiUpload(buffers);
          
          files.forEach((file, idx) => {
               if(file.fieldname === "images") {
                   newImages.push(uploads[idx].secure_url);
               } else if (file.fieldname.startsWith("variantImages_")) {
                   const variantIndex = parseInt(file.fieldname.split("_")[1]);
                    if (!variantUploadMap[variantIndex]) variantUploadMap[variantIndex] = [];
                    variantUploadMap[variantIndex].push(uploads[idx].secure_url);
               }
           });
      }

      // Combine images if there are any changes
      // NOTE: `data.existingImages` should be passed into the service if it was in the body
      let currentImages = [];
      if (data.existingImages) {
          currentImages = typeof data.existingImages === "string" 
             ? JSON.parse(data.existingImages) 
             : data.existingImages;
      }
      
      // If we have new images or are managing existing ones
      if (data.existingImages || (files && files.length > 0)) {
           if(currentImages.length > 0 || newImages.length > 0) {
                allowedData.images = [...currentImages, ...newImages];
           }
      }
      
      // Update variants with new images
      if (allowedData.variants && Array.isArray(allowedData.variants)) {
           allowedData.variants = allowedData.variants.map((variant, index) => {
               // Clean up temporary IDs
               const variantData = { ...variant };
               if (variantData._id && variantData._id.startsWith("temp-")) {
                   delete variantData._id;
               }

               // If this variant has new uploaded images
               if (variantUploadMap[index]) {
                    const existingVariantImages = variantData.images || [];
                    variantData.images = [...existingVariantImages, ...variantUploadMap[index]];
               }
               return variantData;
           });
       }


      const product = await Product.findByIdAndUpdate(id, allowedData, {
        new: true,
        runValidators: true,
      }).populate("category", "name slug");

      if (!product) {
        throw new Error("Product not found");
      }

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

    return product;
  }

  // Permanently delete product
  async permanentDeleteProduct(id) {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  // Add variant to product
  async addVariant(productId, variantData, files) {
    // Only allow specific variant fields
    const allowedVariantData = {
      sku: variantData.sku,
      color: variantData.color,
      size: variantData.size,
      stock: variantData.stock,
      price: variantData.price,
      // images: variantData.images, // Will be handled below if files present
    };

    // Handle image files
    if (files && files.length > 0) {
        const buffers = files.map((file) => file.buffer);
        const uploads = await multiUpload(buffers);
        allowedVariantData.images = uploads.map((upload) => upload.secure_url);
    } else if (variantData.images) {
        // If images passed as array of strings (urls)
        allowedVariantData.images = variantData.images;
    }

    // Check if SKU already exists
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
    // Only allow specific variant fields
    const allowedVariantData = {
      _id: variantId, // Keep the variant ID
    };

    const allowedFields = ["sku", "color", "size", "stock", "images", "price"];
    allowedFields.forEach((field) => {
      if (variantData[field] !== undefined) {
        allowedVariantData[field] = variantData[field];
      }
    });

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
    const filter = {
      isActive: true,
      isFeatured: true,
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return products;
  }

  // Get new arrival products (simple - 10 items only)
  async getNewArrivalProducts(query) {
    const filter = {
      isActive: true,
      isNewArrival: true,
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return products;
  }

  // Get products on sale (simple - 10 items only)
  async getOnSaleProducts(query) {
    const filter = {
      isActive: true,
      onSale: true,
      "price.discountPrice": { $ne: null }, // Chỉ lấy sản phẩm có giá giảm
    };

    const products = await Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return products;
  }
  // Search products (optimized for search bar/autocomplete)
  async searchProducts(keyword, limit = 10) {
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
