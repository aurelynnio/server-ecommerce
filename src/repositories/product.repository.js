const Product = require("../models/product.model");
const BaseRepository = require("./base.repository");

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  findPublishedByIdsForWishlist(productIds) {
    return this.findManyByFilter({
      _id: { $in: productIds },
      status: "published",
    })
      .select("name slug price ratingAverage reviewCount soldCount shop variants.images variants.name variants.color")
      .populate("shop", "name logo")
      .populate("category", "name slug")
      .lean();
  }

  countActiveFlashSale(now) {
    return this.countByFilter({
      status: "published",
      "flashSale.isActive": true,
      "flashSale.startTime": { $lte: now },
      "flashSale.endTime": { $gte: now },
    });
  }

  findActiveFlashSaleProducts(now, { skip, limit }) {
    return this.findManyByFilter({
      status: "published",
      "flashSale.isActive": true,
      "flashSale.startTime": { $lte: now },
      "flashSale.endTime": { $gte: now },
    })
      .select("name slug price flashSale soldCount stock shop variants descriptionImages")
      .populate("shop", "name logo")
      .sort({ "flashSale.soldCount": -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  findFlashSaleProductsBySlot(slotStart, slotEnd, limit = 50) {
    return this.findManyByFilter({
      status: "published",
      "flashSale.isActive": true,
      "flashSale.startTime": { $lte: slotEnd },
      "flashSale.endTime": { $gte: slotStart },
    })
      .select("name slug images price flashSale")
      .populate("shop", "name")
      .limit(limit)
      .lean();
  }

  aggregateTotalFlashSaleSold() {
    return this.aggregateByPipeline([
      { $match: { "flashSale.isActive": true } },
      { $group: { _id: null, total: { $sum: "$flashSale.soldCount" } } },
    ]);
  }

  findTopFlashSaleProducts(limit = 10) {
    return this.findManyByFilter({ "flashSale.isActive": true })
      .sort({ "flashSale.soldCount": -1 })
      .limit(limit)
      .select("name flashSale.soldCount flashSale.salePrice")
      .lean();
  }

  setFlashSaleByProductId(productId, flashSale) {
    return this.updateById(
      productId,
      { $set: { flashSale } },
      { new: true, runValidators: true },
    );
  }

  removeFlashSaleByProductId(productId) {
    return this.updateById(
      productId,
      { $unset: { flashSale: 1 } },
      { new: true },
    );
  }

  findByIds(productIds) {
    return this.findManyByFilter({ _id: { $in: productIds } });
  }

  decrementStockForVariantSale(productId, variantId, quantity, session) {
    return this.updateOneByFilter(
      {
        _id: productId,
        status: "published",
        "variants._id": variantId,
        "variants.stock": { $gte: quantity },
      },
      {
        $inc: {
          "variants.$.stock": -quantity,
          "variants.$.sold": quantity,
          stock: -quantity,
          soldCount: quantity,
        },
      },
      { session },
    );
  }

  decrementStockForBaseSale(productId, quantity, session) {
    return this.updateOneByFilter(
      {
        _id: productId,
        status: "published",
        stock: { $gte: quantity },
      },
      {
        $inc: {
          stock: -quantity,
          soldCount: quantity,
        },
      },
      { session },
    );
  }

  restoreStockForVariant(productId, variantId, quantity, options = {}) {
    return this.updateOneByFilter(
      {
        _id: productId,
        "variants._id": variantId,
      },
      {
        $inc: {
          "variants.$.stock": quantity,
          "variants.$.sold": -quantity,
          stock: quantity,
          soldCount: -quantity,
        },
      },
      options,
    );
  }

  restoreStockForBaseProduct(productId, quantity, options = {}) {
    return this.updateOneByFilter(
      { _id: productId },
      {
        $inc: {
          stock: quantity,
          soldCount: -quantity,
        },
      },
      options,
    );
  }

  countPublishedProducts() {
    return this.countByFilter({ status: "published" });
  }

  findTopSellingProducts(limit = 5) {
    return this.findManyByFilter({ soldCount: { $gt: 0 } })
      .sort({ soldCount: -1 })
      .limit(limit)
      .select("name price soldCount variants slug")
      .lean();
  }

  aggregatePublishedCountsByShopCategories(shopId, categoryIds = []) {
    return this.aggregateByPipeline([
      {
        $match: {
          shop: shopId,
          shopCategory: { $in: categoryIds },
          status: "published",
        },
      },
      {
        $group: {
          _id: "$shopCategory",
          count: { $sum: 1 },
        },
      },
    ]);
  }

  countPublishedByShop(shopId, category = null) {
    const filter = {
      shop: shopId,
      status: "published",
    };
    if (category) {
      filter.category = category;
    }

    return this.countByFilter(filter);
  }

  findPublishedByShop(shopId, { category, sort = "-createdAt", skip, limit }) {
    const filter = { shop: shopId, status: "published" };
    if (category) {
      filter.category = category;
    }

    return this.findManyByFilter(filter)
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  findTopSellingByShop(shopId, limit = 5) {
    return this.findManyByFilter({ shop: shopId, soldCount: { $gt: 0 } })
      .sort({ soldCount: -1 })
      .limit(limit)
      .select("name soldCount price variants slug")
      .lean();
  }

  findByShopIdSelectIds(shopId) {
    return this.findManyByFilter({ shop: shopId }).select("_id");
  }

  aggregateShopCategories(shopId) {
    return this.aggregateByPipeline([
      { $match: { shop: shopId, status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: "$category._id",
          name: "$category.name",
          slug: "$category.slug",
          productCount: "$count",
        },
      },
      { $sort: { productCount: -1 } },
    ]);
  }

  findPublishedByShopWithIds(shopId) {
    return this.findManyByFilter({
      shop: shopId,
      status: "published",
    }).select("_id");
  }

  countWithCatalogFilters({
    status = "published",
    category,
    brand,
    shop,
    shopCategory,
    minPrice,
    maxPrice,
    tags,
    colors,
    sizes,
    rating,
    search,
  } = {}) {
    const query = status === "all" ? { status: { $ne: "deleted" } } : { status };

    if (category) {
      query.category = category;
    }
    if (brand) {
      query.brand = brand;
    }
    if (shop) {
      query.shop = shop;
    }
    if (shopCategory) {
      query.shopCategory = shopCategory;
    }

    if (minPrice || maxPrice) {
      query["price.currentPrice"] = {};
      if (minPrice) {
        query["price.currentPrice"].$gte = Number(minPrice);
      }
      if (maxPrice) {
        query["price.currentPrice"].$lte = Number(maxPrice);
      }
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(",");
      query.tags = { $in: tagArray };
    }

    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(",");
      const colorRegexArray = colorArray.map((c) => new RegExp(`^${c}$`, "i"));
      query["variants.color"] = { $in: colorRegexArray };
    }

    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(",");
      query["variants.size"] = { $in: sizeArray };
    }

    if (rating) {
      const ratingArray = Array.isArray(rating) ? rating : rating.split(",").map(Number);
      const minRating = Math.min(...ratingArray);
      if (!isNaN(minRating)) {
        query.averageRating = { $gte: minRating };
      }
    }

    if (search) {
      query.$text = { $search: search };
    }

    return this.countByFilter(query);
  }

  findWithCatalogFilters(
    {
      status = "published",
      category,
      brand,
      shop,
      shopCategory,
      minPrice,
      maxPrice,
      tags,
      colors,
      sizes,
      rating,
      search,
    } = {},
    { sort = "-createdAt", skip = 0, limit = 10 } = {},
  ) {
    const query = status === "all" ? { status: { $ne: "deleted" } } : { status };

    if (category) {
      query.category = category;
    }
    if (brand) {
      query.brand = brand;
    }
    if (shop) {
      query.shop = shop;
    }
    if (shopCategory) {
      query.shopCategory = shopCategory;
    }

    if (minPrice || maxPrice) {
      query["price.currentPrice"] = {};
      if (minPrice) {
        query["price.currentPrice"].$gte = Number(minPrice);
      }
      if (maxPrice) {
        query["price.currentPrice"].$lte = Number(maxPrice);
      }
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(",");
      query.tags = { $in: tagArray };
    }

    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(",");
      const colorRegexArray = colorArray.map((c) => new RegExp(`^${c}$`, "i"));
      query["variants.color"] = { $in: colorRegexArray };
    }

    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(",");
      query["variants.size"] = { $in: sizeArray };
    }

    if (rating) {
      const ratingArray = Array.isArray(rating) ? rating : rating.split(",").map(Number);
      const minRating = Math.min(...ratingArray);
      if (!isNaN(minRating)) {
        query.averageRating = { $gte: minRating };
      }
    }

    if (search) {
      query.$text = { $search: search };
    }

    let productsQuery = this.findManyByFilter(query)
      .populate("category", "name slug")
      .populate("shopCategory", "name slug");

    if (search) {
      productsQuery = productsQuery
        .select({ score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } });
    } else {
      productsQuery = productsQuery.sort(sort);
    }

    return productsQuery.skip(skip).limit(limit).lean();
  }

  findByIdWithCategoryShopAndShopCategory(id) {
    return this.findById(id)
      .populate("category", "name slug")
      .populate("shop", "name logo")
      .populate("shopCategory", "name slug");
  }

  findBySlugWithCategoryShopAndShopCategory(slug) {
    return this.findOneByFilter({ slug })
      .populate("category", "name slug")
      .populate("shop", "name logo")
      .populate("shopCategory", "name slug");
  }

  findByIdWithCategoryNameLean(productId) {
    return this.findById(productId).populate("category", "name").lean();
  }

  updateByIdWithCategory(productId, updateData) {
    return this.updateById(
      productId,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).populate("category", "name slug");
  }

  findBySlug(slug) {
    return this.findOneByFilter({ slug });
  }

  findBySlugExcludingId(slug, productId) {
    return this.findOneByFilter({
      slug,
      _id: { $ne: productId },
    });
  }

  findByVariantSku(sku) {
    return this.findOneByFilter({ "variants.sku": sku });
  }

  pushVariant(productId, variantData) {
    return this.updateById(
      productId,
      { $push: { variants: variantData } },
      { new: true, runValidators: true },
    );
  }

  replaceVariant(productId, variantId, variantData) {
    return this.findOneAndUpdateByFilter(
      { _id: productId, "variants._id": variantId },
      { $set: { "variants.$": variantData } },
      { new: true, runValidators: true },
    );
  }

  pullVariant(productId, variantId) {
    return this.updateById(
      productId,
      { $pull: { variants: { _id: variantId } } },
      { new: true },
    );
  }

  findByIdAndShop(productId, shopId) {
    return this.findOneByFilter({ _id: productId, shop: shopId });
  }

  softDeleteByIdAndShop(productId, shopId) {
    return this.findOneAndUpdateByFilter(
      { _id: productId, shop: shopId },
      { status: "deleted" },
      { new: true },
    );
  }

  findByCategory(categoryId, { sort = "-createdAt", skip = 0, limit = 10 } = {}) {
    return this.findManyByFilter({
      category: categoryId,
      status: "published",
    })
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  countByCategory(categoryId) {
    return this.countByFilter({
      category: categoryId,
      status: "published",
    });
  }

  findByCategoryIds(categoryIds, { sort = "-createdAt", skip = 0, limit = 10 } = {}) {
    return this.findManyByFilter({
      category: { $in: categoryIds },
      status: "published",
    })
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  countByCategoryIds(categoryIds) {
    return this.countByFilter({
      category: { $in: categoryIds },
      status: "published",
    });
  }

  findPublishedNewest(limit = 10) {
    return this.findManyByFilter({ status: "published" })
      .populate("category", "name slug")
      .sort("-createdAt")
      .limit(Number(limit))
      .lean();
  }

  findFeatured(limit = 10) {
    return this.findManyByFilter({
      status: "published",
      isFeatured: true,
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  findNewArrival(limit = 10) {
    return this.findManyByFilter({
      status: "published",
      isNewArrival: true,
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  findOnSale(now = new Date(), limit = 10) {
    return this.findManyByFilter({
      status: "published",
      $or: [
        { "price.discountPrice": { $ne: null, $gt: 0 } },
        {
          "flashSale.isActive": true,
          "flashSale.startTime": { $lte: now },
          "flashSale.endTime": { $gt: now },
        },
      ],
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  searchByKeyword(keyword, limit = 10) {
    return this.findManyByFilter({
      status: "published",
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
        { "category.name": { $regex: keyword, $options: "i" } },
      ],
    })
      .select("name slug price category variants")
      .populate("category", "name slug")
      .limit(Number(limit))
      .lean();
  }

  findRelatedByCategoryAndPrice(currentProduct, { minPrice, maxPrice, limit = 10 }) {
    return this.findManyByFilter({
      _id: { $ne: currentProduct._id },
      category: currentProduct.category,
      status: "published",
      "price.currentPrice": { $gte: minPrice, $lte: maxPrice },
    })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  findPublishedAutocomplete(regex, limit = 10) {
    return this.findManyByFilter({
      status: "published",
      $or: [{ name: regex }, { tags: regex }],
    })
      .select("name slug price variants")
      .limit(limit)
      .lean();
  }

  findTrendingProducts(limit = 10) {
    return this.findManyByFilter({ status: "published" })
      .sort({ soldCount: -1 })
      .select("name")
      .limit(limit)
      .lean();
  }

  findHotKeywordProducts(limit = 20) {
    return this.findManyByFilter({ status: "published" })
      .sort({ soldCount: -1, ratingAverage: -1 })
      .select("name tags")
      .limit(limit)
      .lean();
  }

  countAdvancedSearch(query) {
    return this.countByFilter(query);
  }

  findAdvancedSearch(query, { sort, skip, limit, withTextScore = false }) {
    let productsQuery = this.findManyByFilter(query)
      .populate("category", "name slug")
      .populate("shop", "name logo");

    if (withTextScore) {
      productsQuery = productsQuery.select({ score: { $meta: "textScore" } });
    }

    return productsQuery
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  aggregatePriceRangeFacets(baseQuery) {
    return this.aggregateByPipeline([
      { $match: baseQuery },
      {
        $bucket: {
          groupBy: "$price.currentPrice",
          boundaries: [0, 100000, 500000, 1000000, 5000000, Infinity],
          default: "Other",
          output: { count: { $sum: 1 } },
        },
      },
    ]);
  }

  aggregateCategoryFacets(baseQuery, limit = 10) {
    return this.aggregateByPipeline([
      { $match: baseQuery },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: "$category._id",
          name: "$category.name",
          slug: "$category.slug",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
  }

  aggregateRatingFacets(baseQuery) {
    return this.aggregateByPipeline([
      { $match: baseQuery },
      {
        $bucket: {
          groupBy: "$ratingAverage",
          boundaries: [0, 3, 4, 4.5, 5],
          default: "unrated",
          output: { count: { $sum: 1 } },
        },
      },
    ]);
  }

  findByIdsSelectCategory(productIds) {
    return this.findManyByFilter({
      _id: { $in: productIds },
    }).select("category");
  }

  findPersonalizedByCategory(categoryIds, excludeIds, limit = 20) {
    return this.findManyByFilter({
      _id: { $nin: excludeIds },
      category: { $in: categoryIds },
      status: "published",
    })
      .select("name slug images price ratingAverage soldCount shop")
      .populate("shop", "name logo")
      .sort({ soldCount: -1, ratingAverage: -1 })
      .limit(limit)
      .lean();
  }

  findPopularExcludingIds(excludeIds, limit = 20) {
    return this.findManyByFilter({
      _id: { $nin: excludeIds },
      status: "published",
    })
      .select("name slug images price ratingAverage soldCount shop")
      .populate("shop", "name logo")
      .sort({ soldCount: -1 })
      .limit(limit)
      .lean();
  }

  findGuestRecommendations(limit = 20) {
    return this.findManyByFilter({ status: "published" })
      .select("name slug images price ratingAverage soldCount shop category")
      .populate("shop", "name logo")
      .populate("category", "name slug")
      .sort({ soldCount: -1, ratingAverage: -1 })
      .limit(limit)
      .lean();
  }

  findPublishedByIdsBasic(productIds) {
    return this.findManyByFilter({
      _id: { $in: productIds },
      status: "published",
    })
      .select("name slug images price")
      .lean();
  }

  findSimilarByCategoryAndPrice(productId, categoryId, minPrice, maxPrice, limit = 10) {
    return this.findManyByFilter({
      _id: { $ne: productId },
      category: categoryId,
      status: "published",
      "price.currentPrice": { $gte: minPrice, $lte: maxPrice },
    })
      .select("name slug images price ratingAverage soldCount")
      .sort({ ratingAverage: -1, soldCount: -1 })
      .limit(limit)
      .lean();
  }

  findPublishedByIdsForRecent(viewedIds, limit = 10) {
    return this.findManyByFilter({
      _id: { $in: viewedIds.slice(0, limit) },
      status: "published",
    })
      .select("name slug images price")
      .lean();
  }

  findCategoryRecommendations(categoryId, limit = 20) {
    return this.findManyByFilter({
      category: categoryId,
      status: "published",
    })
      .select("name slug images price ratingAverage soldCount")
      .sort({ soldCount: -1, ratingAverage: -1 })
      .limit(limit)
      .lean();
  }

  findHomepagePopular(limit = 10) {
    return this.findManyByFilter({ status: "published" })
      .sort({ soldCount: -1 })
      .limit(limit)
      .select("name slug images price soldCount")
      .lean();
  }

  findHomepageNewArrivals(limit = 10) {
    return this.findManyByFilter({ status: "published", isNewArrival: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("name slug images price")
      .lean();
  }

  findHomepageTopRated(limit = 10) {
    return this.findManyByFilter({ status: "published", reviewCount: { $gte: 5 } })
      .sort({ ratingAverage: -1 })
      .limit(limit)
      .select("name slug images price ratingAverage")
      .lean();
  }

  findPublishedForEmbedding() {
    return this.findManyByFilter({ status: "published" })
      .populate("category", "name")
      .select("name slug description brand tags sizes variants price status isFeatured isNewArrival stock soldCount ratingAverage updatedAt")
      .lean();
  }

  findTextFallback(query, { sort = { soldCount: -1 }, limit = 5 } = {}) {
    return this.findManyByFilter(query)
      .populate("category", "name")
      .select("name slug price variants brand category stock isFeatured")
      .sort(sort)
      .limit(limit)
      .lean();
  }

  findFeaturedForEmbedding(type = "featured", limit = 5) {
    const query = { status: "published" };
    let sort = { soldCount: -1 };

    if (type === "featured") {
      query.isFeatured = true;
    } else if (type === "newArrivals") {
      query.isNewArrival = true;
      sort = { createdAt: -1 };
    } else if (type === "onSale") {
      query["price.discountPrice"] = { $exists: true, $ne: null };
      query.$expr = { $lt: ["$price.discountPrice", "$price.currentPrice"] };
    }

    return this.findManyByFilter(query)
      .populate("category", "name")
      .select("name slug price variants brand category stock isFeatured isNewArrival soldCount")
      .sort(sort)
      .limit(limit)
      .lean();
  }

  findFallbackTextSearch(queryText, { isFeatured, categoryId, limit = 5 } = {}) {
    const query = {
      status: "published",
      $or: [
        { name: { $regex: queryText, $options: "i" } },
        { description: { $regex: queryText, $options: "i" } },
        { brand: { $regex: queryText, $options: "i" } },
        { tags: { $elemMatch: { $regex: queryText, $options: "i" } } },
      ],
    };

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured;
    }
    if (categoryId) {
      query.category = categoryId;
    }

    return this.findManyByFilter(query)
      .populate("category", "name")
      .select("name slug price variants brand category stock isFeatured")
      .sort({ soldCount: -1 })
      .limit(limit)
      .lean();
  }

  findTopRatedProducts(limit = 5) {
    return this.findManyByFilter({ totalReviews: { $gt: 0 } })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(limit)
      .select("name slug averageRating totalReviews images");
  }

  findMostReviewedProducts(limit = 5) {
    return this.findManyByFilter({
      totalReviews: { $gt: 0 },
    })
      .sort({ totalReviews: -1 })
      .limit(limit)
      .select("name slug averageRating totalReviews images");
  }

  existsByCategory(categoryId) {
    return this.existsByFilter({ category: categoryId });
  }

  _buildAdvancedSearchQuery({ keyword, categoryIds = [], minPrice, maxPrice, rating } = {}) {
    const query = { status: "published" };

    if (keyword) {
      query.$text = { $search: keyword };
    }

    if (categoryIds.length > 0) {
      query.category = { $in: categoryIds };
    }

    if (minPrice || maxPrice) {
      query["price.currentPrice"] = {};
      if (minPrice) {
        query["price.currentPrice"].$gte = Number(minPrice);
      }
      if (maxPrice) {
        query["price.currentPrice"].$lte = Number(maxPrice);
      }
    }

    if (rating) {
      query.ratingAverage = { $gte: Number(rating) };
    }

    return query;
  }

  _getAdvancedSearchSort(sortBy, keyword) {
    switch (sortBy) {
      case "price_asc":
        return { "price.currentPrice": 1 };
      case "price_desc":
        return { "price.currentPrice": -1 };
      case "newest":
        return { createdAt: -1 };
      case "bestselling":
        return { soldCount: -1 };
      case "rating":
        return { ratingAverage: -1 };
      default:
        return keyword ? { score: { $meta: "textScore" } } : { createdAt: -1 };
    }
  }

  countByAdvancedSearchParams(params = {}) {
    const query = this._buildAdvancedSearchQuery(params);
    return this.countByFilter(query);
  }

  findByAdvancedSearchParams(
    params = {},
    { sortBy = "relevance", skip = 0, limit = 20 } = {},
  ) {
    const query = this._buildAdvancedSearchQuery(params);
    const sort = this._getAdvancedSearchSort(sortBy, params.keyword);

    let productsQuery = this.findManyByFilter(query)
      .populate("category", "name slug")
      .populate("shop", "name logo");

    if (params.keyword) {
      productsQuery = productsQuery.select({ score: { $meta: "textScore" } });
    }

    return productsQuery
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  getSearchFacetsByParams(params = {}) {
    const baseQuery = this._buildAdvancedSearchQuery(params);
    return Promise.all([
      this.aggregatePriceRangeFacets(baseQuery),
      this.aggregateCategoryFacets(baseQuery),
      this.aggregateRatingFacets(baseQuery),
    ]);
  }
}

module.exports = new ProductRepository();
