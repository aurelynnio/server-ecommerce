/**
 * Index migration script for query optimization.
 *
 * Creates compound indexes that follow the ESR (Equality → Sort → Range)
 * principle, and drops indexes that no query in the codebase consumes
 * (single-field indexes shadowed by a compound prefix, or dead indexes left
 * over from removed query paths).
 *
 * Notably KEPT: products `{shopCategory: 1, status: 1}` (catalog queries that
 * filter by shopCategory without shop) and orders `{status: 1}` (countByStatus).
 *
 * Reference: .agents/skills/mongodb-query-optimizer/references/core-indexing-principles.md
 *
 * Usage:
 *   node src/scripts/migrate-indexes.js
 *   node src/scripts/migrate-indexes.js --dry-run   # Preview without writing
 *
 * Safe to run multiple times (create/drop guarded by existence checks).
 */

require('dotenv').config();

const mongoose = require('mongoose');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const DRY_RUN = hasFlag('--dry-run');

function log(msg) {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`${prefix}${msg}`);
}

// Each entry: { collection, spec, options, reason }
const INDEX_OPS = [
  // ---- products ----
  {
    collection: 'products',
    spec: { status: 1, isNewArrival: -1, createdAt: -1 },
    options: { name: 'status_1_isNewArrival_-1_createdAt_-1' },
    reason: 'findNewArrival / findHomepageNewArrivals',
  },
  {
    collection: 'products',
    spec: { status: 1, ratingAverage: -1, reviewCount: -1 },
    options: { name: 'status_1_ratingAverage_-1_reviewCount_-1' },
    reason: 'findTopRatedProducts / findHomepageTopRated / rating catalog filter',
  },
  {
    collection: 'products',
    spec: { status: 1, createdAt: -1 },
    options: { name: 'status_1_createdAt_-1' },
    reason: 'getAllProducts default catalog query (sort newest)',
  },
  {
    collection: 'products',
    spec: { category: 1, status: 1, createdAt: -1 },
    options: { name: 'category_1_status_1_createdAt_-1' },
    reason: 'getAllProducts & getProductsByCategory (category + sort newest)',
  },
  {
    collection: 'products',
    spec: { category: 1, status: 1, 'price.currentPrice': 1 },
    options: { name: 'category_1_status_1_price.currentPrice_1' },
    reason: 'getAllProducts (category + sort price asc)',
  },
  {
    collection: 'products',
    spec: { category: 1, status: 1, 'price.currentPrice': -1 },
    options: { name: 'category_1_status_1_price.currentPrice_-1' },
    reason: 'getAllProducts (category + sort price desc)',
  },
  {
    collection: 'products',
    spec: { category: 1, status: 1, soldCount: -1 },
    options: { name: 'category_1_status_1_soldCount_-1' },
    reason: 'getAllProducts (category + sort best selling)',
  },
  {
    collection: 'products',
    spec: { shop: 1, status: 1, createdAt: -1 },
    options: { name: 'shop_1_status_1_createdAt_-1' },
    reason: 'Shop product listing (sort newest)',
  },
  // ---- orders ----
  {
    collection: 'orders',
    spec: { shopId: 1, paymentStatus: 1 },
    options: { name: 'shopId_1_paymentStatus_1' },
    reason: 'aggregatePaidRevenueByShopId / countByShopWithFilters (payment filter)',
  },
  {
    collection: 'orders',
    spec: { 'products.productId': 1, status: 1 },
    options: { name: 'products.productId_1_status_1' },
    reason: 'existsDeliveredOrderForProductByUser / findOrdersContainingProduct',
  },
  // ---- carts ----
  {
    collection: 'carts',
    spec: { userId: 1 },
    options: { unique: true, name: 'userId_1' },
    reason: 'Primary user cart lookup (findByUserId, checkout, getCart)',
  },
];

// Indexes that no query in the codebase consumes: single-field indexes
// shadowed by a compound prefix, or dead indexes from removed query paths.
// NOTE: {shopCategory: 1, status: 1} on products is intentionally KEPT — it
// serves catalog queries that filter by shopCategory WITHOUT shop.
const DROP_OPS = [
  // ---- orders ----
  { collection: 'orders', indexName: 'shopId_1_status_1', reason: 'Prefix of {shopId,status,createdAt}' },
  { collection: 'orders', indexName: 'paymentStatus_1', reason: 'Prefix of {paymentStatus,createdAt}' },
  { collection: 'orders', indexName: 'userId_1', reason: 'Prefix of {userId,createdAt} / {userId,status}' },
  { collection: 'orders', indexName: 'shopId_1', reason: 'Prefix of {shopId,...} compounds' },
  { collection: 'orders', indexName: 'shipmondoShipmentId_1', reason: 'Legacy Shipmondo field, no code references' },
  { collection: 'orders', indexName: 'shipmondoSalesOrderId_1', reason: 'Legacy Shipmondo field, no code references' },
  // ---- products ----
  { collection: 'products', indexName: 'shop_1', reason: 'Prefix of {shop,status,...} compounds' },
  { collection: 'products', indexName: 'category_1', reason: 'Prefix of {category,status,...} compounds' },
  { collection: 'products', indexName: 'status_1', reason: 'Prefix of every status-first compound' },
  { collection: 'products', indexName: 'isFeatured_1', reason: 'Never queried without status' },
  { collection: 'products', indexName: 'shop_1_status_1', reason: 'Prefix of {shop,status,createdAt}' },
  { collection: 'products', indexName: 'category_1_status_1', reason: 'Prefix of {category,status,createdAt}' },
  { collection: 'products', indexName: 'isActive_1', reason: 'Legacy field replaced by status' },
  { collection: 'products', indexName: 'category_1_isActive_1', reason: 'Legacy isActive field' },
  { collection: 'products', indexName: 'brand_1_isActive_1', reason: 'Legacy isActive field' },
  { collection: 'products', indexName: 'models.sku_1', reason: 'Legacy models[] field replaced by variants[]' },
  { collection: 'products', indexName: 'status_1_variants.size_1', reason: 'variants.size no longer exists in schema' },
  // ---- reviews ----
  { collection: 'reviews', indexName: 'product_1', reason: 'Prefix of {product,createdAt}' },
  { collection: 'reviews', indexName: 'user_1', reason: 'Prefix of {user,createdAt}' },
  // ---- notifications ----
  { collection: 'notifications', indexName: 'userId_1', reason: 'Prefix of {userId,isRead} / {userId,createdAt}' },
  // ---- carts (item ops are in-memory; no abandoned-cart job) ----
  { collection: 'carts', indexName: 'items.productId_1', reason: 'No query consumer' },
  { collection: 'carts', indexName: 'items._id_1', reason: 'No query consumer' },
  { collection: 'carts', indexName: 'userId_1_items._id_1', reason: 'No query consumer' },
  { collection: 'carts', indexName: 'items.shopId_1', reason: 'No query consumer' },
  { collection: 'carts', indexName: 'updatedAt_-1', reason: 'No abandoned-cart scan exists' },
  // ---- conversations ----
  { collection: 'conversations', indexName: 'members_1', reason: 'Prefix of {members,updatedAt}' },
  { collection: 'conversations', indexName: 'shopId_1', reason: 'No query filters shopId alone' },
  // ---- payments ----
  { collection: 'payments', indexName: 'userId_1', reason: 'No query consumer' },
  { collection: 'payments', indexName: 'status_1', reason: 'No query consumer' },
  // ---- shops ----
  { collection: 'shops', indexName: 'name_text', reason: 'No $text search on shops (regex only)' },
  // ---- vouchers ----
  { collection: 'voucher_usages', indexName: 'voucherId_1_userId_1', reason: 'Prefix of unique {voucherId,userId,orderId}' },
  { collection: 'voucher_usages', indexName: 'voucherId_1_createdAt_-1', reason: 'No query consumer' },
  { collection: 'user_saved_vouchers', indexName: 'voucherId_1', reason: 'No count-by-voucher query' },
  { collection: 'wishlists', indexName: 'productId_1', reason: 'No count-by-product query' },
  { collection: 'shop_followers', indexName: 'shopId_1_createdAt_-1', reason: 'shopId count served by unique {shopId,userId}' },
  // ---- banners ----
  { collection: 'banners', indexName: 'isActive_1', reason: 'Prefix of {isActive,order,createdAt}' },
  { collection: 'banners', indexName: 'order_1', reason: 'No order-alone query' },
  // ---- shop categories ----
  { collection: 'shop_categories', indexName: 'shopId_1', reason: 'Prefix of {shopId,displayOrder}' },
  // ---- permission audits ----
  { collection: 'permission_audits', indexName: 'adminId_1', reason: 'No query filters adminId' },
  { collection: 'permission_audits', indexName: 'targetUserId_1', reason: 'Prefix of {targetUserId,createdAt}' },
  { collection: 'permission_audits', indexName: 'timestamp_-1', reason: 'Legacy field replaced by createdAt' },
  { collection: 'permission_audits', indexName: 'targetUserId_1_timestamp_-1', reason: 'Legacy timestamp field' },
  // ---- outbox ----
  { collection: 'outbox_events', indexName: 'eventType_1', reason: 'Never filtered' },
  { collection: 'outbox_events', indexName: 'status_1', reason: 'Prefix of {status,nextRetryAt,createdAt}' },
  { collection: 'outbox_events', indexName: 'nextRetryAt_1', reason: 'Only used inside $or with status' },
];

async function listExistingIndexes(db, collection) {
  try {
    return await db.collection(collection).indexes();
  } catch (e) {
    log(`  (could not list indexes for ${collection}: ${e.message})`);
    return [];
  }
}

async function applyIndexOps(db) {
  log('--- Creating compound indexes ---');

  const groupedByCollection = INDEX_OPS.reduce((acc, op) => {
    if (!acc[op.collection]) acc[op.collection] = [];
    acc[op.collection].push(op);
    return acc;
  }, {});

  for (const [collection, ops] of Object.entries(groupedByCollection)) {
    log(`\nCollection: ${collection}`);
    const existing = await listExistingIndexes(db, collection);
    const existingNames = new Set(existing.map((i) => i.name));

    for (const op of ops) {
      const indexName = op.options.name;
      const alreadyExists = existingNames.has(indexName);

      if (alreadyExists) {
        log(`  [skip] ${indexName} already exists (${op.reason})`);
        continue;
      }

      if (DRY_RUN) {
        log(`  [would create] ${indexName} -> ${JSON.stringify(op.spec)}`);
        log(`       reason: ${op.reason}`);
      } else {
        try {
          await db.collection(collection).createIndex(op.spec, op.options);
          log(`  [created] ${indexName}  (${op.reason})`);
        } catch (e) {
          log(`  [error] ${indexName}: ${e.message}`);
        }
      }
    }
  }
}

async function applyDropOps(db) {
  if (DROP_OPS.length === 0) {
    log('\n--- Drop suboptimal indexes: none scheduled ---');
    return;
  }

  log('\n--- Dropping suboptimal indexes ---');
  for (const op of DROP_OPS) {
    const existing = await listExistingIndexes(db, op.collection);
    const exists = existing.find((i) => i.name === op.indexName);
    if (!exists) {
      log(`  [skip] ${op.collection}.${op.indexName} not found`);
      continue;
    }
    if (DRY_RUN) {
      log(`  [would drop] ${op.collection}.${op.indexName}`);
    } else {
      try {
        await db.collection(op.collection).dropIndex(op.indexName);
        log(`  [dropped] ${op.collection}.${op.indexName}`);
      } catch (e) {
        log(`  [error] dropping ${op.indexName}: ${e.message}`);
      }
    }
  }
}

const ALL_COLLECTIONS = [
  ...new Set([...INDEX_OPS.map((op) => op.collection), ...DROP_OPS.map((op) => op.collection)]),
];

async function printSummary(db) {
  log('\n--- Current index summary ---');
  for (const collection of ALL_COLLECTIONS) {
    const indexes = await listExistingIndexes(db, collection);
    log(`\n${collection} (${indexes.length} indexes):`);
    for (const idx of indexes) {
      const keys = JSON.stringify(idx.key);
      const size = idx.size ? ` ${(idx.size / 1024 / 1024).toFixed(2)} MB` : '';
      log(`  - ${idx.name}: ${keys}${size}`);
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }

  log(`Starting index migration (DRY_RUN=${DRY_RUN})`);

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  try {
    await printSummary(db);
    await applyIndexOps(db);
    await applyDropOps(db);
    log('\n--- Post-migration index summary ---');
    await printSummary(db);
    log('\nIndex migration complete.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('migrate-indexes error:', err?.message || err);
  process.exit(1);
});
