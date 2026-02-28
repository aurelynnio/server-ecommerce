const Category = require("../repositories/category.repository");
const Product = require("../repositories/product.repository");
const slugify = require("slugify");
const { getPaginationParams, buildPaginationResponse } = require("../utils/pagination");
const redisService = require("./redis.service");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");



/**
 * Service handling category operations
 * Manages category creation, retrieval, and updates
 */
class CategoryService {
  /**
   * Create a new category
   * @param {Object} categoryData - Category details
   * @param {string} categoryData.name - Category name
   * @param {string} [categoryData.slug] - Category slug (optional, auto-generated if missing)
   * @param {string} [categoryData.description] - Category description
   * @param {string} [categoryData.parentCategory] - ID of parent category
   * @param {string[]} [categoryData.images] - Array of image URLs
   * @returns {Promise<Object>} Created category object
   * @throws {Error} If parent category not found
   */
  async createCategory(categoryData) {
    // Generate slug if not provided
    if (!categoryData.slug) {
      categoryData.slug = slugify(categoryData.name, {
        lower: true,
        strict: true,
        locale: "vi",
      });
    }

    // Check if slug already exists
    const existingCategory = await Category.findBySlug(categoryData.slug);

    if (existingCategory) {
      // Add random suffix if slug exists
      categoryData.slug = `${categoryData.slug}-${Math.random()
        .toString(36)
        .substr(2, 6)}`;
    }

    // Validate parent category if provided
    if (categoryData.parentCategory) {
      const parentExists = await Category.findById(categoryData.parentCategory);
      if (!parentExists) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Parent category not found");

      }
    }

    const category = await Category.create(categoryData);
    await redisService.delByPattern("categories:*");
    return category;
  }

  /**
   * Get all categories with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {number} filters.page - Page number
   * @param {number} filters.limit - Items per page
   * @param {boolean} [filters.isActive] - Filter by active status
   * @param {string} [filters.parentCategory] - Filter by parent category ID
   * @param {string} [filters.search] - Search term for name/description
   * @returns {Promise<Object>} List of categories with pagination metadata
   * @throws {Error} If page or limit are missing
   */
  async getAllCategories(filters = {}) {
    const { page, limit, isActive, parentCategory, search } = filters;
    const filterArgs = { isActive, parentCategory, search };
    const total = await Category.countWithFilters(filterArgs);

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    const categoriesWithData = await Category.aggregateWithDetails(
      filterArgs,
      paginationParams,
    );

    return buildPaginationResponse(categoriesWithData, paginationParams);
  }

  /**
   * Get category by ID
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Category with parent info
   * @throws {Error} If category not found
   */
  async getCategoryById(categoryId) {
    const category = await Category.findByIdWithParent(categoryId);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    return category;
  }

  /**
   * Get category by slug
   * @param {string} slug - Category slug
   * @returns {Promise<Object>} Category object with parent info
   * @throws {Error} If category not found
   */
  async getCategoryBySlug(slug) {
    const category = await Category.findBySlugWithParent(slug);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    return category;
  }

  /**
   * Get category with its subcategories
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Category with subcategories array
   * @throws {Error} If category not found
   */
  async getCategoryWithSubcategories(categoryId) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    // Get subcategories
    const subcategories = await Category.findActiveSubcategories(categoryId);

    return {
      ...category.toObject(),
      subcategories,
    };
  }

  /**
   * Update a category
   * @param {string} categoryId - Category ID
   * @param {Object} updateData - Data to update
   * @param {string} [updateData.name] - New name
   * @param {string} [updateData.slug] - New slug
   * @param {string} [updateData.parentCategory] - New parent category ID
   * @returns {Promise<Object>} Updated category
   * @throws {Error} If category not found, slug exists, or circular reference
   */
  async updateCategory(categoryId, updateData) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    // If updating name and no slug provided, regenerate slug
    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name, {
        lower: true,
        strict: true,
        locale: "vi",
      });
    }

    // Check slug uniqueness if updating slug
    if (updateData.slug && updateData.slug !== category.slug) {
      const existingCategory = await Category.findBySlugExcludingId(
        updateData.slug,
        categoryId,
      );

      if (existingCategory) {
        throw new ApiError(StatusCodes.CONFLICT, "Slug already exists");

      }
    }

    // Validate parent category if updating
    if (updateData.parentCategory) {
      // Check if parent category exists
      const parentExists = await Category.findById(updateData.parentCategory);
      if (!parentExists) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Parent category not found");

      }

      // Prevent setting self as parent
      if (updateData.parentCategory === categoryId) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Category cannot be its own parent"
        );

      }

      // Prevent circular reference (parent's parent is this category)
      if (parentExists.parentCategory?.toString() === categoryId) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Circular parent-child relationship detected"
        );

      }
    }

    // Update category
    Object.assign(category, updateData);
    await category.save();

    await redisService.delByPattern("categories:*");

    return category;
  }

  /**
   * Delete a category
   * @param {string} categoryId - Category ID
   * @returns {Promise<Object>} Deletion confirmation message
   * @throws {Error} If category not found, has subcategories, or has products
   */
  async deleteCategory(categoryId) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }


    // Check if category has subcategories
    const hasSubcategories = await Category.existsSubcategories(categoryId);

    if (hasSubcategories) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot delete category with subcategories. Please delete or reassign subcategories first."
      );
    }

    // Check if category has products
    const hasProducts = await Product.existsByCategory(categoryId);

    if (hasProducts) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot delete category with products. Please reassign or delete products first."
      );
    }
    await Category.deleteById(categoryId);

    await redisService.delByPattern("categories:*");

    return { message: "Category deleted successfully" };
  }

  /**
   * Get hierarchical category tree (with caching)
   * @returns {Promise<Array>} Tree structure of categories with nested subcategories
   */
  async getCategoryTree() {
    const cacheKey = "categories:tree";
    const cachedTree = await redisService.get(cacheKey);
    if (cachedTree) return cachedTree;

    // Get all root categories (no parent)
    const rootCategories = await Category.findRootActiveForTree();

    const allSubcategories = await Category.findAllActiveSubcategoriesForTree();

    // Build tree structure
    const buildTree = (parentId) => {
      return allSubcategories
        .filter(
          (cat) =>
            cat.parentCategory && cat.parentCategory.toString() === parentId
        )
        .map((cat) => {
          const children = buildTree(cat._id.toString());
          const result = { ...cat };

          // Chỉ thêm subcategories nếu thực sự có category con
          if (children && children.length > 0) {
            result.subcategories = children;
          }

          return result;
        });
    };

    const tree = rootCategories.map((cat) => {
      const children = buildTree(cat._id.toString());
      const result = { ...cat };

      // Chỉ thêm subcategories nếu thực sự có category con
      if (children && children.length > 0) {
        result.subcategories = children;
      }

      return result;
    });

    await redisService.set(cacheKey, tree, 86400); // 24 hours
    return tree;
  }

  /**
   * Get active categories for public display
   * @param {Object} [filters] - Filter options
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=10] - Items per page
   * @param {string} [filters.parentCategory] - Filter by parent category
   * @returns {Promise<Object>} Categories with pagination
   */
  async getActiveCategories(filters = {}) {
    const { page = 1, limit = 10, parentCategory } = filters;

    const total = await Category.countActiveWithParent(parentCategory);
    const paginationParams = getPaginationParams(page, limit, total);

    const categories = await Category.findActiveWithParentPagination(
      parentCategory,
      paginationParams,
    );

    return buildPaginationResponse(categories, paginationParams);
  }

  /**
   * Get category statistics for admin dashboard
   * @returns {Promise<Object>} Statistics including counts and top categories
   */
  async getCategoryStatistics() {
    const totalCategories = await Category.countAllCategories();
    const activeCategories = await Category.countActiveCategories();
    const rootCategories = await Category.countRootCategories();

    const categoriesWithProductCount = await Category.aggregateTopCategoriesByProductCount(5);

    return {
      totalCategories,
      activeCategories,
      rootCategories,
      topCategoriesByProductCount: categoriesWithProductCount,
    };
  }
}

module.exports = new CategoryService();


