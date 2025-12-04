const Category = require("../models/category.model");
const Product = require("../models/product.model");
const slugify = require("slugify");
const { getPaginationParams } = require("../utils/pagination");

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
    const existingCategory = await Category.findOne({
      slug: categoryData.slug,
    });

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
        throw new Error("Parent category not found");
      }
    }

    const category = await Category.create(categoryData);
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

    // Validate required params
    if (!page || !limit) {
      throw new Error("Page and limit are required parameters");
    }

    // Build query
    const query = {};

    if (typeof isActive === "boolean") {
      query.isActive = isActive;
    }

    if (parentCategory !== undefined) {
      if (parentCategory === "null" || parentCategory === null) {
        query.parentCategory = null;
      } else {
        query.parentCategory = parentCategory;
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Count total items first
    const total = await Category.countDocuments(query);

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    // Execute query
    const categories = await Category.find(query)
      .populate("parentCategory", "name slug")
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    // Calculate product count and get subcategories for each category
    const categoriesWithProductCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({
          category: category._id,
          isActive: true,
        });

        // Get subcategories
        const subcategories = await Category.find({
          parentCategory: category._id,
        }).lean();

        // Get product count for subcategories
        const subcategoriesWithCount = await Promise.all(
          subcategories.map(async (sub) => {
            const subProductCount = await Product.countDocuments({
              category: sub._id,
              isActive: true,
            });
            return {
              ...sub,
              productCount: subProductCount,
            };
          })
        );

        return {
          ...category,
          productCount,
          subcategories: subcategoriesWithCount,
        };
      })
    );

    return {
      data: categoriesWithProductCount,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalPages: paginationParams.totalPages,
        totalItems: paginationParams.totalItems,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  // Get category by ID
  async getCategoryById(categoryId) {
    const category = await Category.findById(categoryId).populate(
      "parentCategory",
      "name slug"
    );

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  }

  // Get category by slug
  async getCategoryBySlug(slug) {
    const category = await Category.findOne({ slug }).populate(
      "parentCategory",
      "name slug"
    );

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  }

  // Get category with subcategories
  async getCategoryWithSubcategories(categoryId) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new Error("Category not found");
    }

    // Get subcategories
    const subcategories = await Category.find({
      parentCategory: categoryId,
      isActive: true,
    }).select("name slug images");

    return {
      ...category.toObject(),
      subcategories,
    };
  }

  // Update category
  async updateCategory(categoryId, updateData) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new Error("Category not found");
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
      const existingCategory = await Category.findOne({
        slug: updateData.slug,
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        throw new Error("Slug already exists");
      }
    }

    // Validate parent category if updating
    if (updateData.parentCategory) {
      // Check if parent category exists
      const parentExists = await Category.findById(updateData.parentCategory);
      if (!parentExists) {
        throw new Error("Parent category not found");
      }

      // Prevent setting self as parent
      if (updateData.parentCategory === categoryId) {
        throw new Error("Category cannot be its own parent");
      }

      // Prevent circular reference (parent's parent is this category)
      if (parentExists.parentCategory?.toString() === categoryId) {
        throw new Error("Circular parent-child relationship detected");
      }
    }

    // Update category
    Object.assign(category, updateData);
    await category.save();

    return category;
  }

  // Delete category
  async deleteCategory(categoryId) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new Error("Category not found");
    }

    // Check if category has subcategories
    const hasSubcategories = await Category.exists({
      parentCategory: categoryId,
    });

    if (hasSubcategories) {
      throw new Error(
        "Cannot delete category with subcategories. Please delete or reassign subcategories first."
      );
    }

    // Check if category has products
    const hasProducts = await Product.exists({ category: categoryId });

    if (hasProducts) {
      throw new Error(
        "Cannot delete category with products. Please reassign or delete products first."
      );
    }

    await category.deleteOne();

    return { message: "Category deleted successfully" };
  }

  // Get category tree (hierarchical structure)
  async getCategoryTree() {
    // Get all root categories (no parent)
    const rootCategories = await Category.find({
      parentCategory: null,
      isActive: true,
    })
      .select("name slug images")
      .lean();

    // Get all subcategories in one query
    const allSubcategories = await Category.find({
      parentCategory: { $ne: null },
      isActive: true,
    })
      .select("name slug images parentCategory")
      .lean();

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

    return tree;
  }

  // Get active categories (for public)
  async getActiveCategories(filters = {}) {
    const { page = 1, limit = 10, parentCategory } = filters;

    // Query for active categories
    const query = { isActive: true };

    if (parentCategory !== undefined) {
      query.parentCategory = parentCategory;
    }

    // Get pagination params
    const { skip, limit: pageLimit } = getPaginationParams(page, limit);

    // Execute query
    const [categories, total] = await Promise.all([
      Category.find(query)
        .populate("parentCategory", "name slug")
        .select("-__v")
        .sort({ name: 1 })
        .skip(skip)
        .limit(pageLimit),
      Category.countDocuments(query),
    ]);

    return {
      categories,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / pageLimit),
        totalItems: total,
        itemsPerPage: pageLimit,
      },
    };
  }

  // Get category statistics (Admin)
  async getCategoryStatistics() {
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });
    const rootCategories = await Category.countDocuments({
      parentCategory: null,
    });

    // Get categories with product count
    const categoriesWithProductCount = await Category.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $project: {
          name: 1,
          slug: 1,
          productCount: { $size: "$products" },
        },
      },
      { $sort: { productCount: -1 } },
      { $limit: 5 },
    ]);

    return {
      totalCategories,
      activeCategories,
      rootCategories,
      topCategoriesByProductCount: categoriesWithProductCount,
    };
  }
}

module.exports = new CategoryService();
