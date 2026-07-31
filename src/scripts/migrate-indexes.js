/**
 * One-time index migration script for query optimization.
 *
 * Adds compound indexes that follow the ESR (Equality → Sort → Range)
 * principle to the `products` and `orders` collections. The DROP_OPS list
 * below is reserved for future suboptimal-index removal; it is intentionally
 * empty in this run because every existing index still has a query consumer
 * (notably `{shopCategory: 1, status: 1}`, which serves catalog queries that
 * filter by shopCategory without shop).
 *
 * Reference: .agents/skills/mongodb-query-optimizer/references/core-indexing-principles.md
 *
 * Usage:
 *   node src/scripts/migrate-indexes.js
 *   node src/scripts/migrate-indexes.js --dry-run   # Preview without writing
 *
 * Safe to run multiple times (createIndex is idempotent for identical specs).
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
];

// Single-field indexes that are now suboptimal / redundant.
// NOTE: {shopCategory: 1, status: 1} is intentionally KEPT — it serves catalog
// queries that filter by shopCategory WITHOUT shop (see _buildCatalogQuery).
const DROP_OPS = [
  // { collection: 'products', indexName: 'tags_1' }, // example slot
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

async function printSummary(db) {
  log('\n--- Current index summary ---');
  for (const collection of ['products', 'orders']) {
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
