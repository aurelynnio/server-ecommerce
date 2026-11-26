const { MistralAIEmbeddings } = require('@langchain/mistralai');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Product = require('../repositories/product.repository');
const Category = require('../repositories/category.repository');
const logger = require('../utils/logger');
const redisService = require('./redis.service');
const { getProductFlashSale } = require('../utils/flashSale.util');

const QUERY_VECTOR_CACHE_PREFIX = 'embed:q:';
const QUERY_VECTOR_TTL_SECONDS = Number(process.env.EMBEDDING_QUERY_CACHE_TTL) || 3600;
const EMBEDDING_MODEL = 'mistral-embed';

// Singleton embedding model
let embeddingModel = null;

/**
 * Get or create embedding model instance
 * @returns {MistralAIEmbeddings}
 */
function getEmbeddingModel() {
  if (!embeddingModel) {
    embeddingModel = new MistralAIEmbeddings({
      apiKey: process.env.MISTRAL_API_KEY,
      model: EMBEDDING_MODEL,
      maxRetries: 2,
      ...(process.env.MISTRAL_TIMEOUT_MS
        ? { timeout: Number(process.env.MISTRAL_TIMEOUT_MS) }
        : {}),
    });
  }
  return embeddingModel;
}

/**
 * Get the product embeddings collection
 * @returns {Collection}
 */
function getEmbeddingsCollection() {
  const client = mongoose.connection.getClient();
  return client.db().collection('product_embeddings');
}

function isProductEmbeddingEligible(product) {
  return product?.status === 'published' && product?.shop?.status === 'active';
}

function computeContentHash(textContent) {
  return crypto.createHash('sha256').update(String(textContent)).digest('hex');
}

/**
 * Lấy vector embedding cho câu query, có cache Redis theo hash(query).
 * Tránh gọi API Mistral lặp lại cho cùng một câu hỏi (rất phổ biến với chatbot).
 * @param {string} query
 * @returns {Promise<number[]>}
 */
async function getQueryVector(query) {
  const cacheKey = `${QUERY_VECTOR_CACHE_PREFIX}${crypto
    .createHash('sha256')
    .update(String(query).toLowerCase().trim())
    .digest('hex')
    .slice(0, 32)}`;

  const cached = await redisService.get(cacheKey);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const embeddings = getEmbeddingModel();
  const [vector] = await embeddings.embedDocuments([query]);

  if (Array.isArray(vector) && vector.length > 0) {
    await redisService.set(cacheKey, vector, QUERY_VECTOR_TTL_SECONDS);
  }

  return vector;
}

// Phủ đủ 7 ngành hàng của storefront, khớp cả từ tiếng Anh lẫn tiếng Việt.
// Dùng Unicode letter boundary thay \b: \b không hiểu chữ có dấu (ê, ồ...)
// nên sẽ fail với "cà phê", đồng thời tránh khớp nhầm "top" trong "laptop".
const keywordTerm = (words) =>
  new RegExp(`(?<!\\p{L})(?:${words.join('|')})(?!\\p{L})`, 'iu');

const INDUSTRY_KEYWORD_RULES = [
  // 1. Điện thoại & Phụ kiện
  {
    pattern: keywordTerm([
      'phone',
      'smartphone',
      'mobile',
      'tablet',
      'iphone',
      'samsung',
      'charger',
      'cable',
      'headphone',
      'earbud',
      'powerbank',
      'case',
      'protector',
      'điện thoại',
      'máy tính bảng',
      'ốp lưng',
      'sạc dự phòng',
      'tai nghe',
      'cáp sạc',
    ]),
    synonyms:
      'điện thoại, smartphone, máy tính bảng, ốp lưng, sạc dự phòng, tai nghe, cáp sạc, dán màn hình',
  },
  // 2. Thời trang
  {
    pattern: keywordTerm([
      'shirt',
      't-shirt',
      'tee',
      'polo',
      'top',
      'tank',
      'jacket',
      'hoodie',
      'áo',
      'áo thun',
      'áo phông',
      'áo sơ mi',
      'quần',
      'quần short',
      'quần dài',
      'quần jean',
      'legging',
      'jogger',
      'váy',
      'đầm',
      'giày',
      'sneaker',
      'dép',
      'sandal',
      'mũ',
      'nón',
      'khăn',
      'túi xách',
      'balo',
      'ví',
      'đồng hồ',
      'kính mát',
      'kính râm',
      'găng tay',
      'đồ bơi',
      'áo tắm',
      'bikini',
    ]),
    synonyms:
      'áo thun, áo phông, áo polo, áo sơ mi, quần short, quần dài, quần jean, váy đầm, giày dép, mũ nón, túi xách, balo, ví, đồng hồ, kính mát',
  },
  // 3. Làm đẹp
  {
    pattern: keywordTerm([
      'cosmetic',
      'skincare',
      'serum',
      'cream',
      'lotion',
      'lipstick',
      'makeup',
      'perfume',
      'fragrance',
      'sunscreen',
      'cleanser',
      'mask',
      'mỹ phẩm',
      'kem dưỡng',
      'sữa rửa mặt',
      'son môi',
      'nước hoa',
      'kem chống nắng',
      'mặt nạ',
      'dưỡng da',
    ]),
    synonyms:
      'mỹ phẩm, kem dưỡng da, serum, sữa rửa mặt, son môi, nước hoa, kem chống nắng, mặt nạ dưỡng da',
  },
  // 4. Nhà cửa & Đời sống
  {
    pattern: keywordTerm([
      'furniture',
      'kitchen',
      'cookware',
      'pot',
      'pan',
      'blanket',
      'pillow',
      'mattress',
      'lamp',
      'chair',
      'table',
      'storage',
      'cleaning',
      'detergent',
      'nồi',
      'chảo',
      'chăn',
      'gối',
      'đệm',
      'đèn',
      'bàn',
      'ghế',
      'kệ',
      'tủ',
      'nước giặt',
      'đồ gia dụng',
    ]),
    synonyms:
      'đồ gia dụng, nồi chảo, chăn ga gối, đèn ngủ, bàn ghế, kệ tủ, nước giặt, đồ vệ sinh nhà cửa',
  },
  // 5. Máy tính & Thiết bị
  {
    pattern: keywordTerm([
      'laptop',
      'computer',
      'keyboard',
      'mouse',
      'monitor',
      'printer',
      'router',
      'ssd',
      'ram',
      'cpu',
      'webcam',
      'speaker',
      'máy tính',
      'bàn phím',
      'chuột',
      'màn hình',
      'máy in',
      'ổ cứng',
    ]),
    synonyms:
      'laptop, máy tính, bàn phím, chuột máy tính, màn hình, máy in, router wifi, ổ cứng ssd, loa máy tính',
  },
  // 6. Thể thao & Du lịch
  {
    pattern: keywordTerm([
      'sport',
      'gym',
      'yoga',
      'running',
      'ball',
      'tent',
      'travel',
      'suitcase',
      'bicycle',
      'cycling',
      'camping',
      'thể thao',
      'chạy bộ',
      'bóng đá',
      'lều',
      'vali',
      'du lịch',
      'xe đạp',
      'cắm trại',
    ]),
    synonyms:
      'đồ thể thao, quần áo gym, thảm yoga, giày chạy bộ, bóng đá, lều cắm trại, vali, balo du lịch, xe đạp',
  },
  // 7. Thực phẩm & Đồ uống
  {
    pattern: keywordTerm([
      'coffee',
      'tea',
      'snack',
      'milk',
      'rice',
      'food',
      'beverage',
      'chocolate',
      'juice',
      'nut',
      'grain',
      'cà phê',
      'trà',
      'bánh kẹo',
      'sữa',
      'gạo',
      'thực phẩm',
      'nước uống',
      'hạt dinh dưỡng',
    ]),
    synonyms:
      'cà phê, trà, bánh kẹo, sữa, gạo, thực phẩm khô, nước uống, sô-cô-la, hạt dinh dưỡng',
  },
];

function getVietnameseKeywords(product) {
  const combined =
    `${product.name || ''} ${product.brand || ''} ${product.category?.name || ''} ${(product.tags || []).join(' ')}`.toLowerCase();

  return INDUSTRY_KEYWORD_RULES.filter(({ pattern }) => pattern.test(combined))
    .map(({ synonyms }) => synonyms)
    .join('. ');
}

/**
 * Create text content for embedding from product data
 * Combines name, description, brand, category, tags for rich semantic representation
 * @param {Object} product - Product document
 * @returns {string}
 */
function createProductTextContent(product) {
  const parts = [];

  // Product name is most important
  if (product.name) {
    parts.push(`Tên sản phẩm: ${product.name}`);
  }

  const viKeywords = getVietnameseKeywords(product);
  if (viKeywords) {
    parts.push(`Từ khóa tiếng Việt: ${viKeywords}`);
  }

  /**
   * If
   * @param {any} product.brand
   * @returns {any}
   */
  if (product.brand) {
    parts.push(`Thương hiệu: ${product.brand}`);
  }

  /**
   * If
   * @param {any} product.category?.name
   * @returns {any}
   */
  if (product.category?.name) {
    parts.push(`Danh mục: ${product.category.name}`);
  }

  /**
   * If
   * @param {any} product.tags && product.tags.length > 0
   * @returns {any}
   */
  if (product.tags && product.tags.length > 0) {
    parts.push(`Tags: ${product.tags.join(', ')}`);
  }

  /**
   * If
   * @param {any} product.sizes && product.sizes.length > 0
   * @returns {any}
   */
  if (product.sizes && product.sizes.length > 0) {
    parts.push(`Kích cỡ: ${product.sizes.join(', ')}`);
  }

  const colors = [...new Set(product.variants?.map((v) => v.color).filter(Boolean))];
  /**
   * If
   * @param {any} colors.length > 0
   * @returns {any}
   */
  if (colors.length > 0) {
    parts.push(`Màu sắc: ${colors.join(', ')}`);
  }

  const { isFlashSale, salePrice } = getProductFlashSale(product);
  const price = salePrice ?? product.price?.discountPrice ?? product.price?.currentPrice;
  /**
   * If
   * @param {number} price
   * @returns {any}
   */
  if (price) {
    parts.push(`Giá: ${price.toLocaleString('vi-VN')}đ`);
  }
  if (isFlashSale && Number.isFinite(salePrice)) {
    parts.push(`Giá flash sale: ${salePrice.toLocaleString('vi-VN')}đ`);
  }

  const attributes = (product.attributes || [])
    .filter((attribute) => attribute?.name && attribute?.value)
    .slice(0, 10)
    .map((attribute) => `${attribute.name}: ${attribute.value}`);
  if (attributes.length > 0) {
    parts.push(`Thông số: ${attributes.join(', ')}`);
  }

  /**
   * If
   * @param {any} product.description
   * @returns {any}
   */
  if (product.description) {
    const truncatedDesc = product.description.substring(0, 500);
    parts.push(`Mô tả: ${truncatedDesc}`);
  }

  return parts.join('. ');
}

/**
 * Text riêng cho BM25: chỉ chứa giá trị thực, KHÔNG chứa nhãn tĩnh
 * ("Tên sản phẩm:", "Giá:"...) để tránh mọi document khớp mọi truy vấn.
 * @param {Object} product
 * @returns {string}
 */
function createProductSearchText(product) {
  const colors = [...new Set((product.variants || []).map((v) => v.color).filter(Boolean))];
  const attributes = (product.attributes || [])
    .filter((attribute) => attribute?.name && attribute?.value)
    .slice(0, 10)
    .flatMap((attribute) => [attribute.name, attribute.value]);

  return [
    product.name,
    product.brand,
    product.category?.name,
    ...(product.tags || []),
    ...(product.sizes || []),
    ...colors,
    ...attributes,
    product.description ? String(product.description).slice(0, 500) : '',
  ]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .slice(0, 3000);
}

/**
 * Create metadata for vector store
 * @param {Object} product - Product document
 * @returns {Object}
 */
function createProductMetadata(product, now = new Date()) {
  const { isFlashSale, salePrice } = getProductFlashSale(product, now);
  const regularPrice = product.price?.discountPrice || product.price?.currentPrice;
  const effectivePrice = salePrice ?? regularPrice;
  const originalPrice = product.price?.currentPrice;

  return {
    productId: product._id.toString(),
    name: product.name,
    slug: product.slug,
    brand: product.brand || null,
    category: product.category?.name || null,
    categoryId: product.category?._id?.toString() || null,
    price: effectivePrice,
    originalPrice,
    hasDiscount: Boolean(
      isFlashSale ||
        (product.price?.discountPrice && product.price.discountPrice < product.price.currentPrice),
    ),
    status: product.status,
    shopStatus: product.shop?.status || null,
    isFeatured: product.isFeatured || false,
    isNewArrival: product.isNewArrival || false,
    stock: product.stock || 0,
    soldCount: product.soldCount || 0,
    ratingAverage: product.ratingAverage || 0,
    image: product.variants?.[0]?.images?.[0] || null,
    productUrl: `/products/${product.slug}`,
    checkoutUrl: `/checkout?product=${product._id}`,
    updatedAt: product.updatedAt || new Date(),
  };
}

/**
 * Generate embeddings for a single product and store in MongoDB
 * @param {Object} product - Product document with populated category
 * @returns {Promise<boolean>}
 */
async function embedProduct(product) {
  try {
    const embeddings = getEmbeddingModel();
    const collection = getEmbeddingsCollection();

    const textContent = createProductTextContent(product);
    const metadata = createProductMetadata(product);

    const [vector] = await embeddings.embedDocuments([textContent]);

    await collection.updateOne(
      { productId: product._id.toString() },
      {
        $set: {
          productId: product._id.toString(),
          embedding: vector,
          text: textContent,
          searchText: createProductSearchText(product),
          contentHash: computeContentHash(textContent),
          embeddingModel: EMBEDDING_MODEL,
          metadata,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return true;
  } catch (error) {
    logger.error('[Embeddings] Error embedding product:', {
      productId: product._id,
      error: error.message,
    });
    return false;
  }
}

/**
 * Generate embeddings for all published products (Optimized Batch Processing)
 * Uses bulk embedding API and bulk DB writes for max speed
 * @param {Object} options - Options
 * @param {number} options.batchSize - Batch size for API calls (default 50)
 * @param {boolean} options.force - Force re-embed all products (default false)
 * @returns {Promise<{success: number, failed: number, skipped: number}>}
 */
async function embedAllProducts({ batchSize = 50, force = false } = {}) {
  const stats = { success: 0, failed: 0, skipped: 0 };

  try {
    const embeddings = getEmbeddingModel();
    const collection = getEmbeddingsCollection();

    const products = (await Product.findPublishedForEmbedding()).filter(isProductEmbeddingEligible);

    logger.info(`[Embeddings] Starting to embed ${products.length} products...`);

    // Get existing embeddings map for quick lookup
    const existingMap = new Map();
    if (!force) {
      const existing = await collection
        .find({}, { projection: { productId: 1, 'metadata.updatedAt': 1, searchText: 1 } })
        .toArray();
      existing.forEach((e) => {
        // Document cũ chưa có searchText phải re-embed để BM25 chuyển sang
        // trường mới (tránh index text cũ chỉ toàn nhãn tĩnh).
        if (!e.searchText) return;
        existingMap.set(e.productId, new Date(e.metadata?.updatedAt || 0).getTime());
      });
    }

    // Optimized: Run batches in parallel chunks
    const CONCURRENCY = 2; // Reduced to 2 to match Rate Limit
    const allBatches = [];

    // 1. Prepare all batches
    for (let i = 0; i < products.length; i += batchSize) {
      allBatches.push(products.slice(i, i + batchSize));
    }

    // 2. Process chunks of batches
    for (let i = 0; i < allBatches.length; i += CONCURRENCY) {
      const currentChunk = allBatches.slice(i, i + CONCURRENCY);

      await Promise.all(
        currentChunk.map(async (batch) => {
          const docsToEmbed = [];
          const productsToEmbed = [];

          for (const product of batch) {
            const key = product._id.toString();
            const productTime = new Date(product.updatedAt || 0).getTime();

            if (!force && existingMap.has(key) && existingMap.get(key) >= productTime) {
              stats.skipped++;
              continue;
            }

            const textContent = createProductTextContent(product);
            docsToEmbed.push(textContent);
            productsToEmbed.push({ product, textContent });
          }

          if (docsToEmbed.length > 0) {
            try {
              const vectors = await embeddings.embedDocuments(docsToEmbed);

              const bulkOps = productsToEmbed.map((item, idx) => ({
                updateOne: {
                  filter: { productId: item.product._id.toString() },
                  update: {
                    $set: {
                      productId: item.product._id.toString(),
                      embedding: vectors[idx],
                      text: item.textContent,
                      searchText: createProductSearchText(item.product),
                      contentHash: computeContentHash(item.textContent),
                      embeddingModel: EMBEDDING_MODEL,
                      metadata: createProductMetadata(item.product),
                      updatedAt: new Date(),
                    },
                  },
                  upsert: true,
                },
              }));

              if (bulkOps.length > 0) {
                const result = await collection.bulkWrite(bulkOps);
                stats.success += result.upsertedCount + result.modifiedCount;
              }
            } catch (error) {
              logger.error(`[Embeddings] Batch failed:`, error.message);
              stats.failed += docsToEmbed.length;
            }
          }
        }),
      );

      const processedCount = Math.min((i + CONCURRENCY) * batchSize, products.length);
      logger.info(`[Embeddings] Processed ${processedCount}/${products.length} products`);
    }

    logger.info('[Embeddings] Embedding complete:', stats);
    return stats;
  } catch (error) {
    logger.error('[Embeddings] Error in embedAllProducts:', error.message);
    throw error;
  }
}

/**
 * Delete embedding for a product
 * @param {string} productId
 * @returns {Promise<boolean>}
 */
async function deleteProductEmbedding(productId) {
  try {
    const collection = getEmbeddingsCollection();
    await collection.deleteOne({ productId: productId.toString() });
    return true;
  } catch (error) {
    logger.error('[Embeddings] Error deleting embedding:', {
      productId,
      error: error.message,
    });
    return false;
  }
}

function buildEmbeddingFilter(filter = {}) {
  const result = {
    'metadata.status': filter.status || 'published',
  };
  if (filter.categoryId) result['metadata.categoryId'] = String(filter.categoryId);
  if (filter.brand) result['metadata.brand'] = String(filter.brand);

  const price = {};
  if (Number.isFinite(filter.minPrice)) price.$gte = filter.minPrice;
  if (Number.isFinite(filter.maxPrice)) price.$lte = filter.maxPrice;
  if (Object.keys(price).length > 0) result['metadata.price'] = price;

  if (filter.inStockOnly || filter.stock === true) {
    result['metadata.stock'] = { $gt: 0 };
  } else if (Number.isFinite(filter.minStock)) {
    result['metadata.stock'] = { $gte: filter.minStock };
  }
  if (typeof filter.hasDiscount === 'boolean') {
    result['metadata.hasDiscount'] = filter.hasDiscount;
  }
  return result;
}

// Vector search là tín hiệu chính (đã qua ngưỡng minScore); BM25 chỉ bổ trợ cho
// các truy vấn từ khóa nên được hạ trọng số để không lấn át kết quả ngữ nghĩa.
const RRF_WEIGHTS = { vector: 1, text: 0.5 };
const DEFAULT_MIN_TEXT_SCORE = Number(process.env.EMBEDDING_MIN_TEXT_SCORE) || 0.5;

function mergeHybridResults(
  vectorResults = [],
  textResults = [],
  { limit = 5, minScore = 0.25, minTextScore = 0, rrfK = 60 } = {},
) {
  const byId = new Map();
  const addRank = (result, rank, kind) => {
    const productId = String(result.productId || result.metadata?.productId || '');
    if (!productId) return;
    const current = byId.get(productId) || {
      ...result,
      productId,
      score: 0,
      scores: { vector: null, text: null, rrf: 0, rerank: 0 },
    };
    current.scores[kind] = result.score;
    current.scores.rrf += RRF_WEIGHTS[kind] / (rrfK + rank + 1);
    current.score = current.scores.rrf;
    if (!current.metadata && result.metadata) current.metadata = result.metadata;
    byId.set(productId, current);
  };

  vectorResults
    .filter((result) => Number(result.score) >= minScore)
    .forEach((result, rank) => addRank(result, rank, 'vector'));
  textResults
    .filter((result) => Number(result.score) >= minTextScore)
    .forEach((result, rank) => addRank(result, rank, 'text'));

  for (const item of byId.values()) {
    const metadata = item.metadata || {};
    const availabilityBonus = Number(metadata.stock) > 0 ? 0.001 : 0;
    const discountBonus = metadata.hasDiscount ? 0.0005 : 0;
    const ratingBonus = Math.max(0, Number(metadata.ratingAverage) || 0) * 0.0001;
    item.scores.rerank = availabilityBonus + discountBonus + ratingBonus;
    item.score = item.scores.rrf + item.scores.rerank;
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId))
    .slice(0, limit);
}

const SEARCH_TEXT_INDEX_NAME = 'idx_embedding_search_text_bm25';
const LEGACY_TEXT_INDEX_NAME = 'idx_embedding_text_bm25';

/**
 * MongoDB chỉ cho phép 1 text index/collection. Chuyển index sang `searchText`
 * (giá trị thực, không nhãn tĩnh) và drop index cũ nếu còn.
 */
async function ensureSearchTextIndex(collection = getEmbeddingsCollection()) {
  const existing = await collection.indexes().catch(() => []);
  if (existing.some((index) => index.name === LEGACY_TEXT_INDEX_NAME)) {
    await collection.dropIndex(LEGACY_TEXT_INDEX_NAME).catch((error) => {
      logger.warn('[Embeddings] Could not drop legacy BM25 text index', {
        error: error.message,
      });
    });
  }
  if (!existing.some((index) => index.name === SEARCH_TEXT_INDEX_NAME)) {
    await collection.createIndex({ searchText: 'text' }, { name: SEARCH_TEXT_INDEX_NAME });
  }
}

// Index text được tạo ngoài Mongoose (raw driver) nên phải đảm bảo tồn tại trước
// truy vấn BM25 đầu tiên; createIndex là idempotent và chỉ chạy 1 lần/process.
let textIndexEnsured = false;
async function ensureTextIndexOnce() {
  if (textIndexEnsured) return;
  try {
    await ensureSearchTextIndex();
    textIndexEnsured = true;
  } catch (error) {
    logger.warn('[Embeddings] Could not ensure BM25 text index', { error: error.message });
  }
}

function formatEmbeddingResult(result) {
  const metadata = result.metadata || {};
  return {
    id: metadata.productId || result.productId,
    name: metadata.name,
    slug: metadata.slug,
    price: metadata.price,
    originalPrice: metadata.originalPrice,
    hasDiscount: metadata.hasDiscount,
    brand: metadata.brand,
    category: metadata.category,
    image: metadata.image,
    productUrl: metadata.productUrl,
    checkoutUrl: metadata.checkoutUrl,
    stock: metadata.stock,
    isFeatured: metadata.isFeatured,
    score: result.score,
    scores: result.scores,
  };
}

async function searchHybridProducts(
  query,
  {
    limit = 5,
    filter = {},
    minScore = Number(process.env.EMBEDDING_MIN_SCORE) || 0.25,
    minTextScore = DEFAULT_MIN_TEXT_SCORE,
  } = {},
) {
  const collection = getEmbeddingsCollection();
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 50);
  const preFilter = buildEmbeddingFilter(filter);
  const candidateLimit = Math.max(safeLimit * 10, 50);

  await ensureTextIndexOnce();

  const vectorPromise = getQueryVector(query).then((queryVector) =>
    collection
      .aggregate([
        {
          $vectorSearch: {
            index: 'product_vector_index',
            path: 'embedding',
            queryVector,
            numCandidates: candidateLimit,
            limit: candidateLimit,
            filter: preFilter,
          },
        },
        {
          $project: {
            _id: 0,
            productId: 1,
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray(),
  );
  const textPromise = collection
    .aggregate([
      { $match: { $text: { $search: String(query).slice(0, 500) }, ...preFilter } },
      { $sort: { score: { $meta: 'textScore' } } },
      { $limit: candidateLimit },
      {
        $project: {
          _id: 0,
          productId: 1,
          metadata: 1,
          score: { $meta: 'textScore' },
        },
      },
    ])
    .toArray();

  const [vectorResult, textResult] = await Promise.allSettled([vectorPromise, textPromise]);
  const vectorItems = vectorResult.status === 'fulfilled' ? vectorResult.value : [];
  const textItems = textResult.status === 'fulfilled' ? textResult.value : [];

  if (vectorResult.status === 'rejected') {
    logger.warn('[Embeddings] Vector search unavailable', { error: vectorResult.reason?.message });
  }
  if (textResult.status === 'rejected') {
    logger.warn('[Embeddings] BM25 text search unavailable', { error: textResult.reason?.message });
  }

  // Đếm ứng viên SAU khi áp ngưỡng, nếu không strategy có thể báo 'hybrid'
  // dù toàn bộ kết quả vector đã bị minScore loại.
  const qualifiedVectorCount = vectorItems.filter(
    (result) => Number(result.score) >= minScore,
  ).length;
  const qualifiedTextCount = textItems.filter(
    (result) => Number(result.score) >= minTextScore,
  ).length;

  const merged = mergeHybridResults(vectorItems, textItems, {
    limit: safeLimit,
    minScore,
    minTextScore,
  });
  if (merged.length > 0) {
    return {
      items: merged.map(formatEmbeddingResult),
      strategy:
        qualifiedVectorCount > 0 && qualifiedTextCount > 0
          ? 'hybrid'
          : qualifiedVectorCount > 0
            ? 'vector_search'
            : 'bm25_text_search',
      candidates: { vector: qualifiedVectorCount, text: qualifiedTextCount },
    };
  }

  const fallbackItems = await fallbackTextSearch(query, { limit: safeLimit, filter });
  return {
    items: fallbackItems,
    strategy: 'fallback_text_search',
    candidates: { vector: qualifiedVectorCount, text: qualifiedTextCount },
  };
}

async function searchSimilarProducts(query, options = {}) {
  const result = await searchHybridProducts(query, options);
  return result.items;
}

/**
 * Fallback text search when vector search is not available
 * @param {string} query
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function fallbackTextSearch(query, { limit = 5, filter = {} } = {}) {
  try {
    let categoryId = null;
    if (mongoose.Types.ObjectId.isValid(filter.categoryId)) {
      categoryId = new mongoose.Types.ObjectId(filter.categoryId);
    } else if (filter.category) {
      const cat = await Category.findByNameRegex(filter.category);
      if (cat) {
        categoryId = cat._id;
      }
    }

    const products = await Product.findFallbackTextSearch(query, {
      isFeatured: filter.isFeatured,
      categoryId,
      brand: filter.brand,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      inStockOnly: filter.inStockOnly || filter.stock === true,
      minStock: filter.minStock,
      hasDiscount: filter.hasDiscount,
      limit,
    });

    return products.map((p) => ({
      id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price?.discountPrice || p.price?.currentPrice,
      originalPrice: p.price?.currentPrice,
      hasDiscount: !!(p.price?.discountPrice && p.price.discountPrice < p.price.currentPrice),
      brand: p.brand,
      category: p.category?.name,
      image: p.variants?.[0]?.images?.[0] || null,
      productUrl: `/products/${p.slug}`,
      checkoutUrl: `/checkout?product=${p._id}`,
      stock: p.stock,
      isFeatured: p.isFeatured,
      score: 1, // No score for text search
    }));
  } catch (error) {
    logger.error('[Embeddings] Fallback text search error:', error.message);
    return [];
  }
}

/**
 * Get featured/popular products (non-semantic query)
 * @param {Object} options
 * @param {string} options.type - "featured", "newArrivals", "bestsellers"
 * @param {number} options.limit
 * @returns {Promise<Array>}
 */
async function getFeaturedProducts({ type = 'featured', limit = 5 } = {}) {
  try {
    const products = await Product.findFeaturedForEmbedding(type, limit);

    // Fallback: if specific query returns empty, get any published products
    if (products.length === 0 && type !== 'bestsellers') {
      logger.info(`[Embeddings] No ${type} products found, falling back to bestsellers`);
      return getFeaturedProducts({ type: 'bestsellers', limit });
    }

    return products.map((p) => ({
      id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price?.discountPrice || p.price?.currentPrice,
      originalPrice: p.price?.currentPrice,
      hasDiscount: !!(p.price?.discountPrice && p.price.discountPrice < p.price.currentPrice),
      brand: p.brand,
      category: p.category?.name,
      image: p.variants?.[0]?.images?.[0] || null,
      productUrl: `/products/${p.slug}`,
      checkoutUrl: `/checkout?product=${p._id}`,
      stock: p.stock,
      isFeatured: p.isFeatured,
    }));
  } catch (error) {
    logger.error('[Embeddings] getFeaturedProducts error:', error.message);
    return [];
  }
}

async function ensureEmbeddingIndexes() {
  const collection = getEmbeddingsCollection();
  const duplicateGroups = await collection
    .aggregate([
      { $sort: { updatedAt: -1, _id: -1 } },
      { $group: { _id: '$productId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
    ])
    .toArray();

  const duplicateIds = duplicateGroups.flatMap((group) => group.ids.slice(1));
  if (duplicateIds.length > 0) {
    await collection.deleteMany({ _id: { $in: duplicateIds } });
    logger.warn('[Embeddings] Removed duplicate product embeddings before unique index', {
      removed: duplicateIds.length,
    });
  }

  await collection.createIndex(
    { productId: 1 },
    { unique: true, name: 'idx_productId_unique' },
  );
  await ensureSearchTextIndex(collection);
  textIndexEnsured = true;
  return true;
}

/**
 * Reconcile embeddings against published products:
 * 1. Re-embed missing or stale published products.
 * 2. Delete orphaned embeddings whose product is no longer published or deleted.
 * @param {Object} [options]
 * @returns {Promise<{embedded: number, skipped: number, failed: number, purged: number}>}
 */
async function reconcileProductEmbeddings({ batchSize = 50 } = {}) {
  await ensureEmbeddingIndexes();
  const collection = getEmbeddingsCollection();
  const publishedProducts = (await Product.findPublishedForEmbedding()).filter(
    isProductEmbeddingEligible,
  );
  const publishedIdSet = new Set(publishedProducts.map((p) => p._id.toString()));

  // Purge orphaned or unpublished embeddings
  const existingDocs = await collection.find({}, { projection: { productId: 1 } }).toArray();
  const orphanIds = existingDocs
    .map((doc) => doc.productId)
    .filter((id) => id && !publishedIdSet.has(String(id)));

  let purged = 0;
  if (orphanIds.length > 0) {
    const delResult = await collection.deleteMany({ productId: { $in: orphanIds } });
    purged = delResult.deletedCount || 0;
  }

  const embedStats = await embedAllProducts({ batchSize, force: false });
  return {
    embedded: embedStats.success,
    skipped: embedStats.skipped,
    failed: embedStats.failed,
    purged,
  };
}

function getVectorSearchDefinition() {
  return {
    name: 'product_vector_index',
    type: 'vectorSearch',
    definition: {
      fields: [
        {
          type: 'vector',
          path: 'embedding',
          numDimensions: 1024,
          similarity: 'cosine',
        },
        ...[
          'metadata.status',
          'metadata.categoryId',
          'metadata.brand',
          'metadata.price',
          'metadata.stock',
          'metadata.hasDiscount',
        ].map((path) => ({ type: 'filter', path })),
      ],
    },
  };
}

/**
 * Create the MongoDB Atlas Vector Search index
 * This needs to be run once to set up the index
 * NOTE: This may need to be done via Atlas UI if programmatic creation is not supported
 */
async function createVectorSearchIndex() {
  try {
    const client = mongoose.connection.getClient();
    const db = client.db();

    const indexes = await db.collection('product_embeddings').listSearchIndexes().toArray();
    const indexDefinition = getVectorSearchDefinition();
    const existingIndex = indexes.find((idx) => idx.name === indexDefinition.name);

    if (existingIndex?.type === 'vectorSearch') {
      logger.info('[Embeddings] Vector search index already exists');
      return true;
    }

    if (existingIndex) {
      await db.collection('product_embeddings').dropSearchIndex(indexDefinition.name);
    }
    await db.collection('product_embeddings').createSearchIndex(indexDefinition);

    logger.info('[Embeddings] Vector search index created successfully');
    return true;
  } catch (error) {
    logger.error('[Embeddings] Error creating vector search index:', error.message);
    logger.info('[Embeddings] You may need to create the index manually via Atlas UI');
    logger.info('[Embeddings] Atlas vectorSearch definition', getVectorSearchDefinition());
    return false;
  }
}

module.exports = {
  EMBEDDING_MODEL,
  getEmbeddingModel,
  createProductTextContent,
  createProductSearchText,
  getVietnameseKeywords,
  computeContentHash,
  embedProduct,
  embedAllProducts,
  deleteProductEmbedding,
  ensureEmbeddingIndexes,
  reconcileProductEmbeddings,
  buildEmbeddingFilter,
  createProductMetadata,
  isProductEmbeddingEligible,
  mergeHybridResults,
  getVectorSearchDefinition,
  searchHybridProducts,
  searchSimilarProducts,
  getFeaturedProducts,
  createVectorSearchIndex,
  fallbackTextSearch,
};
