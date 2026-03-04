const Product = require('../models/product.model');
const Category = require('../models/category.model');
const mongoose = require('mongoose');
const logger = require('./logger'); // Corrected path to logger

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseNumberValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLimit = (limit, fallback = DEFAULT_LIMIT) => {
  const parsed = parseNumberValue(limit);
  if (!parsed || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

const normalizeStringArray = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? item.split(',') : [String(item)]))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
};

const getProductSort = (sortBy) => {
  switch (sortBy) {
    case 'price_asc':
      return { 'price.currentPrice': 1, soldCount: -1 };
    case 'price_desc':
      return { 'price.currentPrice': -1, soldCount: -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'rating':
      return { ratingAverage: -1, soldCount: -1 };
    case 'bestselling':
    default:
      return { soldCount: -1, createdAt: -1 };
  }
};

const mapProductSummary = (product) => {
  const currentPrice = product.price?.currentPrice ?? null;
  const discountPrice = product.price?.discountPrice ?? null;
  const hasDiscount =
    Number.isFinite(discountPrice) && Number.isFinite(currentPrice) && discountPrice < currentPrice;
  const finalPrice = hasDiscount ? discountPrice : currentPrice;
  const discountPercent =
    hasDiscount && currentPrice > 0
      ? Math.round(((currentPrice - discountPrice) / currentPrice) * 100)
      : 0;

  return {
    id: product._id,
    name: product.name,
    slug: product.slug,
    price: finalPrice,
    originalPrice: currentPrice,
    hasDiscount,
    discountPercent,
    brand: product.brand || null,
    category: product.category?.name || null,
    shop: product.shop?.name || null,
    ratingAverage: product.ratingAverage || 0,
    soldCount: product.soldCount || 0,
    stock: product.stock || 0,
    inStock: (product.stock || 0) > 0,
    variantCount: product.variants?.length || 0,
    sizes: product.sizes || [],
    colors: [...new Set(product.variants?.map((variant) => variant.color).filter(Boolean))],
    tags: product.tags || [],
    image: product.variants?.[0]?.images?.[0] || null,
    checkoutUrl: `/checkout?product=${product._id}`,
    productUrl: `/products/${product.slug}`,
  };
};

async function resolveCategoryIds(categoryInput) {
  const categoryTokens = normalizeStringArray(categoryInput);
  if (categoryTokens.length === 0) return [];

  const directIds = categoryTokens.filter((token) => mongoose.Types.ObjectId.isValid(token));
  const searchableTokens = categoryTokens.filter(
    (token) => !mongoose.Types.ObjectId.isValid(token),
  );

  const matchedCategoryIds = new Set(directIds);
  if (searchableTokens.length > 0) {
    const slugCandidates = searchableTokens.map((token) => token.toLowerCase());
    const regexConditions = searchableTokens.map((token) => ({
      name: { $regex: escapeRegex(token), $options: 'i' },
    }));
    const rootCategories = await Category.find({
      isActive: true,
      $or: [{ slug: { $in: slugCandidates } }, ...regexConditions],
    })
      .select('_id')
      .lean();

    rootCategories.forEach((category) => matchedCategoryIds.add(category._id.toString()));

    if (rootCategories.length > 0) {
      const childCategories = await Category.find({
        isActive: true,
        parentCategory: { $in: rootCategories.map((category) => category._id) },
      })
        .select('_id')
        .lean();
      childCategories.forEach((category) => matchedCategoryIds.add(category._id.toString()));
    }
  }

  return [...matchedCategoryIds]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

async function buildSearchQuery({
  keyword,
  category,
  minPrice,
  maxPrice,
  brand,
  colors,
  sizes,
  tags,
  inStockOnly,
  onlyDiscounted,
}) {
  const query = { status: 'published' };

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), 'i');
    query.$or = [
      { name: regex },
      { description: regex },
      { brand: regex },
      { tags: { $elemMatch: { $regex: regex } } },
    ];
  }

  const categoryIds = await resolveCategoryIds(category);
  if (categoryIds.length > 0) {
    query.category = { $in: categoryIds };
  }

  if (brand) {
    query.brand = { $regex: escapeRegex(brand), $options: 'i' };
  }

  const colorList = normalizeStringArray(colors);
  if (colorList.length > 0) {
    query['variants.color'] = {
      $in: colorList.map((color) => new RegExp(`^${escapeRegex(color)}$`, 'i')),
    };
  }

  const sizeList = normalizeStringArray(sizes);
  if (sizeList.length > 0) {
    query.sizes = {
      $in: sizeList.map((size) => new RegExp(`^${escapeRegex(size)}$`, 'i')),
    };
  }

  const tagList = normalizeStringArray(tags);
  if (tagList.length > 0) {
    query.tags = {
      $in: tagList.map((tag) => new RegExp(`^${escapeRegex(tag)}$`, 'i')),
    };
  }

  const min = parseNumberValue(minPrice);
  const max = parseNumberValue(maxPrice);
  if (min !== null || max !== null) {
    query['price.currentPrice'] = {};
    if (min !== null) query['price.currentPrice'].$gte = min;
    if (max !== null) query['price.currentPrice'].$lte = max;
  }

  if (inStockOnly) {
    query.stock = { $gt: 0 };
  }

  if (onlyDiscounted) {
    query['price.discountPrice'] = { $exists: true, $ne: null };
    query.$expr = { $lt: ['$price.discountPrice', '$price.currentPrice'] };
  }

  return query;
}

async function searchProductsByQuery(params = {}) {
  const query = await buildSearchQuery(params);
  const limit = normalizeLimit(params.limit);
  const sort = getProductSort(params.sortBy);

  const products = await Product.find(query)
    .populate('category', 'name slug')
    .populate('shop', 'name slug')
    .select(
      'name slug price variants brand category shop stock soldCount ratingAverage tags sizes createdAt',
    )
    .sort(sort)
    .limit(limit)
    .lean();

  return products.map(mapProductSummary);
}

// Helper function để tìm product theo ID hoặc slug
async function findProduct(productId) {
  const isValidId = mongoose.Types.ObjectId.isValid(productId);

  if (isValidId) {
    const product = await Product.findById(productId).populate('category', 'name').lean();
    if (product) return product;
  }

  // Tìm theo slug
  return await Product.findOne({ slug: productId }).populate('category', 'name').lean();
}

// Tool handlers với error handling
const toolHandlers = {
  async search_products({ keyword, category, minPrice, maxPrice, limit = 5 }) {
    try {
      return await searchProductsByQuery({
        keyword,
        category,
        minPrice,
        maxPrice,
        limit,
      });
    } catch (error) {
      logger.error('[Tool] search_products error:', { error: error.message });
      return { error: 'Không thể tìm kiếm sản phẩm', details: error.message };
    }
  },

  async search_products_advanced({
    keyword,
    category,
    brand,
    minPrice,
    maxPrice,
    colors,
    sizes,
    tags,
    inStockOnly = false,
    onlyDiscounted = false,
    sortBy = 'bestselling',
    limit = 5,
  }) {
    try {
      return await searchProductsByQuery({
        keyword,
        category,
        brand,
        minPrice,
        maxPrice,
        colors,
        sizes,
        tags,
        inStockOnly,
        onlyDiscounted,
        sortBy,
        limit,
      });
    } catch (error) {
      logger.error('[Tool] search_products_advanced error:', {
        error: error.message,
      });
      return {
        error: 'Không thể tìm kiếm nâng cao',
        details: error.message,
      };
    }
  },

  async search_products_by_brand({
    brand,
    keyword,
    minPrice,
    maxPrice,
    sortBy = 'bestselling',
    limit = 5,
  }) {
    try {
      if (!brand) return { error: 'Thiếu tên thương hiệu cần tìm' };
      return await searchProductsByQuery({
        brand,
        keyword,
        minPrice,
        maxPrice,
        sortBy,
        limit,
      });
    } catch (error) {
      logger.error('[Tool] search_products_by_brand error:', {
        error: error.message,
      });
      return {
        error: 'Không thể tìm sản phẩm theo thương hiệu',
        details: error.message,
      };
    }
  },

  async search_products_by_price_range({
    minPrice,
    maxPrice,
    keyword,
    category,
    sortBy = 'price_asc',
    limit = 5,
  }) {
    try {
      if (parseNumberValue(minPrice) === null && parseNumberValue(maxPrice) === null) {
        return { error: 'Thiếu khoảng giá cần tìm' };
      }
      return await searchProductsByQuery({
        keyword,
        category,
        minPrice,
        maxPrice,
        sortBy,
        limit,
      });
    } catch (error) {
      logger.error('[Tool] search_products_by_price_range error:', {
        error: error.message,
      });
      return {
        error: 'Không thể tìm sản phẩm theo khoảng giá',
        details: error.message,
      };
    }
  },

  async get_discounted_products({
    keyword,
    category,
    minDiscountPercent = 5,
    inStockOnly = true,
    limit = 5,
  }) {
    try {
      const rawProducts = await searchProductsByQuery({
        keyword,
        category,
        inStockOnly,
        onlyDiscounted: true,
        sortBy: 'bestselling',
        limit: normalizeLimit(limit) * 3,
      });

      const minPercent = parseNumberValue(minDiscountPercent) ?? 0;
      return rawProducts
        .filter((product) => product.discountPercent >= minPercent)
        .slice(0, normalizeLimit(limit));
    } catch (error) {
      logger.error('[Tool] get_discounted_products error:', {
        error: error.message,
      });
      return {
        error: 'Không thể lấy danh sách sản phẩm giảm giá',
        details: error.message,
      };
    }
  },

  async get_bestseller_products({ category, brand, limit = 5 }) {
    try {
      return await searchProductsByQuery({
        category,
        brand,
        sortBy: 'bestselling',
        limit,
      });
    } catch (error) {
      logger.error('[Tool] get_bestseller_products error:', {
        error: error.message,
      });
      return {
        error: 'Không thể lấy sản phẩm bán chạy',
        details: error.message,
      };
    }
  },

  async get_new_arrival_products({ category, brand, limit = 5 }) {
    try {
      return await searchProductsByQuery({
        category,
        brand,
        sortBy: 'newest',
        limit,
      });
    } catch (error) {
      logger.error('[Tool] get_new_arrival_products error:', {
        error: error.message,
      });
      return {
        error: 'Không thể lấy sản phẩm mới',
        details: error.message,
      };
    }
  },

  async get_related_products({ productId, limit = 5 }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: 'Không tìm thấy sản phẩm' };

      const query = {
        status: 'published',
        _id: { $ne: product._id },
      };

      if (product.category) {
        query.category = product.category._id || product.category;
      }

      if (product.brand) {
        query.brand = { $regex: escapeRegex(product.brand), $options: 'i' };
      }

      const products = await Product.find(query)
        .populate('category', 'name slug')
        .populate('shop', 'name slug')
        .select(
          'name slug price variants brand category shop stock soldCount ratingAverage tags sizes createdAt',
        )
        .sort({ soldCount: -1, ratingAverage: -1 })
        .limit(normalizeLimit(limit))
        .lean();

      return products.map(mapProductSummary);
    } catch (error) {
      logger.error('[Tool] get_related_products error:', {
        error: error.message,
      });
      return {
        error: 'Không thể lấy sản phẩm liên quan',
        details: error.message,
      };
    }
  },

  async get_search_filter_options({ keyword, category, brand, minPrice, maxPrice }) {
    try {
      const query = await buildSearchQuery({
        keyword,
        category,
        brand,
        minPrice,
        maxPrice,
      });

      const candidates = await Product.find(query)
        .populate('category', 'name slug')
        .select('brand category sizes variants.color price')
        .limit(200)
        .lean();

      const brands = [...new Set(candidates.map((item) => item.brand).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'vi'),
      );

      const categoriesMap = new Map();
      candidates.forEach((item) => {
        if (!item.category?._id) return;
        const key = item.category._id.toString();
        if (!categoriesMap.has(key)) {
          categoriesMap.set(key, {
            id: key,
            name: item.category.name,
            slug: item.category.slug,
          });
        }
      });

      const sizes = [
        ...new Set(candidates.flatMap((item) => item.sizes || []).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, 'vi'));

      const colors = [
        ...new Set(
          candidates.flatMap((item) =>
            (item.variants || []).map((variant) => variant.color).filter(Boolean),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, 'vi'));

      const prices = candidates
        .map((item) => {
          const currentPrice = item.price?.currentPrice ?? null;
          const discountPrice = item.price?.discountPrice ?? null;
          const hasDiscount =
            Number.isFinite(discountPrice) &&
            Number.isFinite(currentPrice) &&
            discountPrice < currentPrice;
          return hasDiscount ? discountPrice : currentPrice;
        })
        .filter((price) => Number.isFinite(price));

      return {
        brands,
        categories: [...categoriesMap.values()],
        sizes,
        colors,
        priceRange: {
          min: prices.length > 0 ? Math.min(...prices) : null,
          max: prices.length > 0 ? Math.max(...prices) : null,
        },
        totalCandidates: candidates.length,
      };
    } catch (error) {
      logger.error('[Tool] get_search_filter_options error:', {
        error: error.message,
      });
      return {
        error: 'Không thể lấy bộ lọc tìm kiếm',
        details: error.message,
      };
    }
  },

  async get_product_details({ productId }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: 'Không tìm thấy sản phẩm' };

      return {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price?.discountPrice || product.price?.currentPrice,
        originalPrice: product.price?.currentPrice,
        hasDiscount:
          product.price?.discountPrice && product.price.discountPrice < product.price.currentPrice,
        brand: product.brand,
        category: product.category?.name,
        variants: product.variants?.map((v) => ({
          id: v._id,
          size: v.size,
          color: v.color,
          stock: v.stock,
          price: v.price?.discountPrice || v.price?.currentPrice,
          image: v.images?.[0],
        })),
        checkoutUrl: `/checkout?product=${product._id}`,
        productUrl: `/products/${product.slug}`,
      };
    } catch (error) {
      logger.error('[Tool] get_product_details error:', {
        error: error.message,
      });
      return {
        error: 'Không thể lấy thông tin sản phẩm',
        details: error.message,
      };
    }
  },

  async get_categories() {
    try {
      const categories = await Category.find({ isActive: true })
        .select('name slug description')
        .lean();

      return categories.map((c) => ({
        name: c.name,
        slug: c.slug,
        url: `/categories/${c.slug}`,
      }));
    } catch (error) {
      logger.error('[Tool] get_categories error:', { error: error.message });
      return { error: 'Không thể lấy danh mục' };
    }
  },

  async get_featured_products({ type = 'featured', limit = 5 }) {
    try {
      // Note: isActive and onSale are virtual fields, use status and price conditions instead
      const query = { status: 'published' };
      let sort = { soldCount: -1 };

      if (type === 'featured') {
        query.isFeatured = true;
      } else if (type === 'newArrivals') {
        query.isNewArrival = true;
        sort = { createdAt: -1 };
      } else if (type === 'onSale') {
        // onSale is a virtual field - we need to query the actual price fields
        // Products with discountPrice < currentPrice
        query['price.discountPrice'] = { $exists: true, $ne: null };
        query.$expr = { $lt: ['$price.discountPrice', '$price.currentPrice'] };
      }

      const products = await Product.find(query)
        .populate('category', 'name')
        .select('name slug price variants brand')
        .sort(sort)
        .limit(limit)
        .lean();

      // Fallback: if query returns empty, get any published products
      if (products.length === 0 && (type === 'featured' || type === 'newArrivals')) {
        logger.info(`[Tool] No ${type} products found, falling back to all products`);
        const fallbackProducts = await Product.find({ status: 'published' })
          .populate('category', 'name')
          .select('name slug price variants brand')
          .sort({ soldCount: -1 })
          .limit(limit)
          .lean();

        return fallbackProducts.map((p) => ({
          id: p._id,
          name: p.name,
          slug: p.slug,
          price: p.price?.discountPrice || p.price?.currentPrice,
          originalPrice: p.price?.currentPrice,
          brand: p.brand,
          image: p.variants?.[0]?.images?.[0] || null,
          checkoutUrl: `/checkout?product=${p._id}`,
          productUrl: `/products/${p.slug}`,
        }));
      }

      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        brand: p.brand,
        image: p.variants?.[0]?.images?.[0] || null,
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      logger.error('[Tool] get_featured_products error:', {
        error: error.message,
      });
      return { error: 'Không thể lấy sản phẩm nổi bật' };
    }
  },

  async check_product_availability({ productId, size, color }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: 'Không tìm thấy sản phẩm' };

      let variants = product.variants || [];

      if (size) variants = variants.filter((v) => v.size?.toLowerCase() === size.toLowerCase());
      if (color) variants = variants.filter((v) => v.color?.toLowerCase() === color.toLowerCase());

      const available = variants.filter((v) => v.stock > 0);

      return {
        productName: product.name,
        productSlug: product.slug,
        available: available.length > 0,
        variants: available.map((v) => ({
          id: v._id,
          size: v.size,
          color: v.color,
          stock: v.stock,
          price: v.price?.discountPrice || v.price?.currentPrice,
        })),
        totalStock: available.reduce((sum, v) => sum + v.stock, 0),
        message:
          available.length > 0
            ? `Còn ${available.reduce((sum, v) => sum + v.stock, 0)} sản phẩm`
            : 'Hết hàng',
        checkoutUrl:
          available.length > 0
            ? `/checkout?product=${product._id}&variant=${available[0]._id}`
            : null,
        productUrl: `/products/${product.slug}`,
      };
    } catch (error) {
      logger.error('[Tool] check_product_availability error:', {
        error: error.message,
      });
      return { error: 'Không thể kiểm tra tồn kho' };
    }
  },

  async generate_checkout_link({ productId, variantId, quantity = 1 }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: 'Không tìm thấy sản phẩm' };

      let checkoutUrl = `/checkout?product=${product._id}&quantity=${quantity}`;
      if (variantId) checkoutUrl += `&variant=${variantId}`;

      const variant = variantId
        ? product.variants?.find((v) => v._id.toString() === variantId)
        : product.variants?.[0];

      return {
        checkoutUrl,
        addToCartUrl: `/cart/add?product=${product._id}${variantId ? `&variant=${variantId}` : ''}&quantity=${quantity}`,
        productUrl: `/products/${product.slug}`,
        product: {
          name: product.name,
          slug: product.slug,
          price:
            variant?.price?.discountPrice ||
            variant?.price?.currentPrice ||
            product.price?.currentPrice,
          variant: variant ? { size: variant.size, color: variant.color } : null,
          quantity,
        },
        message: 'Nhấn vào link để tiến hành thanh toán ngay!',
      };
    } catch (error) {
      logger.error('[Tool] generate_checkout_link error:', {
        error: error.message,
      });
      return { error: 'Không thể tạo link thanh toán' };
    }
  },

  async compare_products({ productIds }) {
    try {
      const products = [];

      for (const id of productIds) {
        const product = await findProduct(id);
        if (product) products.push(product);
      }

      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        sizes: [...new Set(p.variants?.map((v) => v.size).filter(Boolean))],
        colors: [...new Set(p.variants?.map((v) => v.color).filter(Boolean))],
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      logger.error('[Tool] compare_products error:', { error: error.message });
      return { error: 'Không thể so sánh sản phẩm' };
    }
  },
};

module.exports = { toolHandlers };
