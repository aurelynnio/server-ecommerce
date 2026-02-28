const { MistralAIEmbeddings } = require("@langchain/mistralai");
const mongoose = require("mongoose");
const Product = require("../repositories/product.repository");
const Category = require("../repositories/category.repository");
const logger = require("../utils/logger");

// Singleton embedding model
let embeddingModel = null;

/**
 * Get or create embedding model instance
 * @returns {MistralAIEmbeddings}
 */
function getEmbeddingModel() {
  /**
   * If
   * @param {any} !embeddingModel
   * @returns {any}
   */
  if (!embeddingModel) {
    embeddingModel = new MistralAIEmbeddings({
      apiKey: process.env.MISTRAL_API_KEY,
      model: "mistral-embed", // Mistral's embedding model
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
  return client.db().collection("product_embeddings");
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
  /**
   * If
   * @param {any} product.name
   * @returns {any}
   */
  if (product.name) {
    parts.push(`Tên sản phẩm: ${product.name}`);
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
    parts.push(`Tags: ${product.tags.join(", ")}`);
  }
  
  /**
   * If
   * @param {any} product.sizes && product.sizes.length > 0
   * @returns {any}
   */
  if (product.sizes && product.sizes.length > 0) {
    parts.push(`Kích cỡ: ${product.sizes.join(", ")}`);
  }
  
  // Colors from variants
  const colors = [...new Set(product.variants?.map(v => v.color).filter(Boolean))];
  /**
   * If
   * @param {any} colors.length > 0
   * @returns {any}
   */
  if (colors.length > 0) {
    parts.push(`Màu sắc: ${colors.join(", ")}`);
  }
  
  // Price range
  const price = product.price?.discountPrice || product.price?.currentPrice;
  /**
   * If
   * @param {number} price
   * @returns {any}
   */
  if (price) {
    parts.push(`Giá: ${price.toLocaleString("vi-VN")}đ`);
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
  
  return parts.join(". ");
}

/**
 * Create metadata for vector store
 * @param {Object} product - Product document
 * @returns {Object}
 */
function createProductMetadata(product) {
  return {
    productId: product._id.toString(),
    name: product.name,
    slug: product.slug,
    brand: product.brand || null,
    category: product.category?.name || null,
    categoryId: product.category?._id?.toString() || null,
    price: product.price?.discountPrice || product.price?.currentPrice,
    originalPrice: product.price?.currentPrice,
    hasDiscount: !!(product.price?.discountPrice && product.price.discountPrice < product.price.currentPrice),
    status: product.status,
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
    
    // Generate embedding vector
    const [vector] = await embeddings.embedDocuments([textContent]);
    
    // Upsert into MongoDB
    await collection.updateOne(
      { productId: product._id.toString() },
      {
        $set: {
          productId: product._id.toString(),
          embedding: vector,
          text: textContent,
          metadata,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    
    return true;
  } catch (error) {
    logger.error("[Embeddings] Error embedding product:", {
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
    
    // Get all published products
    const products = await Product.findPublishedForEmbedding();
    
    logger.info(`[Embeddings] Starting to embed ${products.length} products...`);
    
    // Get existing embeddings map for quick lookup
    const existingMap = new Map();
    if (!force) {
      const existing = await collection.find({}, { projection: { productId: 1, "metadata.updatedAt": 1 } }).toArray();
      existing.forEach(e => {
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
      
      await Promise.all(currentChunk.map(async (batch) => {
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
      }));
      
      const processedCount = Math.min((i + CONCURRENCY) * batchSize, products.length);
      logger.info(`[Embeddings] Processed ${processedCount}/${products.length} products`);
    }
    
    logger.info("[Embeddings] Embedding complete:", stats);
    return stats;
    
  } catch (error) {
    logger.error("[Embeddings] Error in embedAllProducts:", error.message);
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
    logger.error("[Embeddings] Error deleting embedding:", {
      productId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Search for similar products using vector similarity
 * @param {string} query - User query text
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default 5)
 * @param {Object} options.filter - Additional metadata filters
 * @returns {Promise<Array>}
 */
async function searchSimilarProducts(query, { limit = 5, filter = {} } = {}) {
  try {
    const embeddings = getEmbeddingModel();
    const collection = getEmbeddingsCollection();
    
    // Generate embedding for the query
    const [queryVector] = await embeddings.embedDocuments([query]);
    
    // Build the aggregation pipeline for vector search
    // Note: This requires MongoDB Atlas Vector Search index to be created
    const pipeline = [
      {
        $vectorSearch: {
          index: "product_vector_index", // Name of the Atlas Vector Search index
          path: "embedding",
          queryVector: queryVector,
          numCandidates: limit * 10, // Consider more candidates for better results
          limit: limit,
          filter: {
            "metadata.status": "published",
            ...filter,
          },
        },
      },
      {
        $project: {
          _id: 0,
          productId: 1,
          text: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];
    
    const results = await collection.aggregate(pipeline).toArray();
    
    // Format results for chatbot consumption
    return results.map((r) => ({
      id: r.metadata.productId,
      name: r.metadata.name,
      slug: r.metadata.slug,
      price: r.metadata.price,
      originalPrice: r.metadata.originalPrice,
      hasDiscount: r.metadata.hasDiscount,
      brand: r.metadata.brand,
      category: r.metadata.category,
      image: r.metadata.image,
      productUrl: r.metadata.productUrl,
      checkoutUrl: r.metadata.checkoutUrl,
      stock: r.metadata.stock,
      isFeatured: r.metadata.isFeatured,
      score: r.score,
    }));
    
  } catch (error) {
    logger.error("[Embeddings] Vector search error:", error.message);
    
    // Fallback to text search if vector search fails
    // This handles the case where Atlas Vector Search is not configured
    logger.info("[Embeddings] Falling back to text search...");
    return await fallbackTextSearch(query, { limit, filter });
  }
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
    if (filter.category) {
      const cat = await Category.findByNameRegex(filter.category);
      if (cat) {
        categoryId = cat._id;
      }
    }

    const products = await Product.findFallbackTextSearch(query, {
      isFeatured: filter.isFeatured,
      categoryId,
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
    logger.error("[Embeddings] Fallback text search error:", error.message);
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
async function getFeaturedProducts({ type = "featured", limit = 5 } = {}) {
  try {
    const products = await Product.findFeaturedForEmbedding(type, limit);
    
    // Fallback: if specific query returns empty, get any published products
    if (products.length === 0 && type !== "bestsellers") {
      logger.info(`[Embeddings] No ${type} products found, falling back to bestsellers`);
      return getFeaturedProducts({ type: "bestsellers", limit });
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
    logger.error("[Embeddings] getFeaturedProducts error:", error.message);
    return [];
  }
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
    
    // Check if index exists
    const indexes = await db.collection("product_embeddings").listSearchIndexes().toArray();
    const existingIndex = indexes.find(idx => idx.name === "product_vector_index");
    
    if (existingIndex) {
      logger.info("[Embeddings] Vector search index already exists");
      return true;
    }
    
    // Create the vector search index
    // Note: This requires MongoDB Atlas M10+ or serverless
    await db.collection("product_embeddings").createSearchIndex({
      name: "product_vector_index",
      definition: {
        mappings: {
          dynamic: true,
          fields: {
            embedding: {
              type: "knnVector",
              dimensions: 1024, // Mistral embed dimensions
              similarity: "cosine",
            },
            "metadata.status": {
              type: "string",
            },
            "metadata.isFeatured": {
              type: "boolean",
            },
            "metadata.category": {
              type: "string",
            },
          },
        },
      },
    });
    
    logger.info("[Embeddings] Vector search index created successfully");
    return true;
    
  } catch (error) {
    logger.error("[Embeddings] Error creating vector search index:", error.message);
    logger.info("[Embeddings] You may need to create the index manually via Atlas UI");
    logger.info(`
    Index configuration for Atlas UI:
    - Collection: product_embeddings
    - Index name: product_vector_index
    - Field mappings:
      - embedding: knnVector, 1024 dimensions, cosine similarity
      - metadata.status: string
      - metadata.isFeatured: boolean
      - metadata.category: string
    `);
    return false;
  }
}

module.exports = {
  getEmbeddingModel,
  embedProduct,
  embedAllProducts,
  deleteProductEmbedding,
  searchSimilarProducts,
  getFeaturedProducts,
  createVectorSearchIndex,
  fallbackTextSearch,
};


