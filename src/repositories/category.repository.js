const Category = require('../models/category.model');
const BaseRepository = require('./base.repository');

class CategoryRepository extends BaseRepository {
  constructor() {
    super(Category);
  }

  findBySlug(slug) {
    return this.findOneByFilter({ slug });
  }

  findBySlugActive(slug) {
    return this.findOneByFilter({ slug, isActive: true });
  }

  findBySlugExcludingId(slug, categoryId) {
    return this.findOneByFilter({
      slug,
      _id: { $ne: categoryId },
    });
  }

  findByIdWithParent(categoryId) {
    return this.findById(categoryId).populate('parentCategory', 'name slug').lean();
  }

  findBySlugWithParent(slug) {
    return this.findOneByFilter({ slug }).populate('parentCategory', 'name slug').lean();
  }

  findActiveSubcategories(parentCategoryId) {
    return this.findManyByFilter({
      parentCategory: parentCategoryId,
      isActive: true,
    }).select('name slug images');
  }

  existsSubcategories(parentCategoryId) {
    return this.existsByFilter({ parentCategory: parentCategoryId });
  }

  countWithFilters({ isActive, parentCategory, search } = {}) {
    const query = {};

    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
    }

    if (parentCategory !== undefined) {
      if (parentCategory === 'null' || parentCategory === null) {
        query.parentCategory = null;
      } else {
        query.parentCategory = parentCategory;
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    return this.countByFilter(query);
  }

  aggregateWithDetails({ isActive, parentCategory, search } = {}, { skip = 0, limit = 10 } = {}) {
    const query = {};

    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
    }

    if (parentCategory !== undefined) {
      if (parentCategory === 'null' || parentCategory === null) {
        query.parentCategory = null;
      } else {
        query.parentCategory = parentCategory;
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    return this.aggregateByPipeline([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'categories',
          localField: 'parentCategory',
          foreignField: '_id',
          as: 'parentCategoryData',
          pipeline: [{ $project: { name: 1, slug: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'products',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$category', '$$categoryId'] }, { $eq: ['$isActive', true] }],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'productCountData',
        },
      },
      {
        $lookup: {
          from: 'categories',
          let: { parentId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$parentCategory', '$$parentId'] } } },
            {
              $lookup: {
                from: 'products',
                let: { subCategoryId: '$_id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$category', '$$subCategoryId'] },
                          { $eq: ['$isActive', true] },
                        ],
                      },
                    },
                  },
                  { $count: 'count' },
                ],
                as: 'subProductCount',
              },
            },
            {
              $addFields: {
                productCount: {
                  $ifNull: [{ $arrayElemAt: ['$subProductCount.count', 0] }, 0],
                },
              },
            },
            { $project: { subProductCount: 0 } },
          ],
          as: 'subcategories',
        },
      },
      {
        $addFields: {
          parentCategory: { $arrayElemAt: ['$parentCategoryData', 0] },
          productCount: { $ifNull: [{ $arrayElemAt: ['$productCountData.count', 0] }, 0] },
        },
      },
      { $project: { parentCategoryData: 0, productCountData: 0 } },
    ]);
  }

  findRootActiveForTree() {
    return this.findManyByFilter({
      parentCategory: null,
      isActive: true,
    })
      .select('name slug images')
      .lean();
  }

  findAllActiveSubcategoriesForTree() {
    return this.findManyByFilter({
      parentCategory: { $ne: null },
      isActive: true,
    })
      .select('name slug images parentCategory')
      .lean();
  }

  findActiveWithParentPagination(parentCategory, { skip = 0, limit = 10 }) {
    const query = { isActive: true };
    if (parentCategory !== undefined) {
      query.parentCategory = parentCategory;
    }

    return this.findManyByFilter(query)
      .populate('parentCategory', 'name slug')
      .select('-__v')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  countActiveWithParent(parentCategory) {
    const query = { isActive: true };
    if (parentCategory !== undefined) {
      query.parentCategory = parentCategory;
    }

    return this.countByFilter(query);
  }

  countActiveCategories() {
    return this.countByFilter({ isActive: true });
  }

  countRootCategories() {
    return this.countByFilter({ parentCategory: null });
  }

  aggregateTopCategoriesByProductCount(limit = 5) {
    return this.aggregateByPipeline([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products',
        },
      },
      {
        $project: {
          name: 1,
          slug: 1,
          productCount: { $size: '$products' },
        },
      },
      { $sort: { productCount: -1 } },
      { $limit: limit },
    ]);
  }

  findActiveByNameRegex(regex, limit = 5) {
    return this.findManyByFilter({
      isActive: true,
      name: regex,
    })
      .select('name slug images')
      .limit(limit)
      .lean();
  }

  findActiveNames(limit = 10) {
    return this.findManyByFilter({ isActive: true }).select('name').limit(limit).lean();
  }

  findSubcategoryIds(parentCategoryId) {
    return this.findManyByFilter({ parentCategory: parentCategoryId }).select('_id');
  }

  countAllCategories() {
    return this.countByFilter();
  }

  findByNameRegex(nameRegex) {
    return this.findOneByFilter({ name: { $regex: nameRegex, $options: 'i' } });
  }
}

module.exports = new CategoryRepository();
