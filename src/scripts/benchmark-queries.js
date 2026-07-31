/**
 * Query performance benchmark for the optimized MongoDB queries.
 *
 * Runs each representative query N times, reports timing + execution stats
 * (docs scanned, docs returned, index used, COLLSCAN vs IXSCAN), and prints
 * an explain plan for the first run. Designed to be run BEFORE and AFTER the
 * index migration so the deltas can be compared.
 *
 * Usage:
 *   node src/scripts/benchmark-queries.js                # default: 50 iterations
 *   node src/scripts/benchmark-queries.js --iters=100
 *   node src/scripts/benchmark-queries.js --explain      # also print explain plans
 *
 * Requires MONGODB_URI in .env and a populated database (run seed-dev first).
 */

require('dotenv').config();

const mongoose = require('mongoose');

function arg(name, fallback) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
}

const ITERS = Number(arg('iters', 50));
const SHOW_EXPLAIN = process.argv.includes('--explain');

async function fetchSampleIds(db) {
  const product = await db.collection('products').findOne({ status: 'published' });
  const order = await db.collection('orders').findOne({});
  const shop = await db.collection('shops').findOne({});
  const category = await db.collection('categories').findOne({});
  return {
    productId: product?._id,
    shopId: shop?._id,
    categoryId: category?._id,
    userId: order?.userId,
  };
}

function summarizePlan(stage) {
  if (!stage) return {};
  const out = {
    stage: stage.stage,
    totalDocsExamined: stage.totalDocsExamined,
    totalKeysExamined: stage.totalKeysExamined,
    executionTimeMillis: stage.executionTimeMillis,
    isIndexed: stage.stage !== 'COLLSCAN',
  };
  if (stage.inputStage) {
    out.inputStage = stage.inputStage.stage;
    out.indexName = stage.inputStage.indexName;
  }
  if (stage.inputStages) {
    out.inputStages = stage.inputStages.map((s) => s.stage);
  }
  return out;
}

async function runQueryWithTiming(db, name, buildQuery, ids, iters) {
  // Warm-up
  await buildQuery(db, ids).toArray().catch(() => {});

  const stats = { name, times: [], docsExamined: null, keysExamined: null, indexUsed: null };

  for (let i = 0; i < iters; i++) {
    const cursor = buildQuery(db, ids);
    const start = process.hrtime.bigint();
    await cursor.toArray().catch(() => {});
    const end = process.hrtime.bigint();
    stats.times.push(Number(end - start) / 1e6); // ms
  }

  stats.times.sort((a, b) => a - b);
  stats.min = stats.times[0];
  stats.max = stats.times[stats.times.length - 1];
  stats.avg = stats.times.reduce((s, t) => s + t, 0) / stats.times.length;
  stats.median = stats.times[Math.floor(stats.times.length / 2)];
  stats.p95 = stats.times[Math.floor(stats.times.length * 0.95)];

  if (SHOW_EXPLAIN) {
    try {
      const explain = await buildQuery(db, ids).explain();
      const winPlan = explain.queryPlanner?.winningPlan || {};
      const execStats = explain.executionStats || {};
      stats.explain = {
        winningStage: winPlan.stage,
        inputStage: winPlan.inputStage?.stage,
        indexName: winPlan.inputStage?.indexName,
        executionTimeMillis: execStats.executionTimeMillis,
        totalDocsExamined: execStats.totalDocsExamined,
        totalKeysExamined: execStats.totalKeysExamined,
      };
    } catch (e) {
      stats.explainError = e.message;
    }
  }

  return stats;
}

// --- Query definitions (mirrors the optimized repository methods) ---
const QUERIES = [
  {
    name: 'product.findTopRatedProducts',
    build: (db) =>
      db
        .collection('products')
        .find({ status: 'published', reviewCount: { $gt: 0 } })
        .sort({ ratingAverage: -1, reviewCount: -1 })
        .limit(5)
        .project({ name: 1, slug: 1, ratingAverage: 1, reviewCount: 1, images: 1 }),
  },
  {
    name: 'product.findMostReviewedProducts',
    build: (db) =>
      db
        .collection('products')
        .find({ status: 'published', reviewCount: { $gt: 0 } })
        .sort({ reviewCount: -1 })
        .limit(5)
        .project({ name: 1, slug: 1, ratingAverage: 1, reviewCount: 1, images: 1 }),
  },
  {
    name: 'product.findNewArrival',
    build: (db) =>
      db
        .collection('products')
        .find({ status: 'published', isNewArrival: true })
        .sort({ createdAt: -1 })
        .limit(10),
  },
  {
    name: 'product.findHomepageTopRated',
    build: (db) =>
      db
        .collection('products')
        .find({ status: 'published', reviewCount: { $gte: 5 } })
        .sort({ ratingAverage: -1 })
        .limit(10),
  },
  {
    name: 'product.catalog rating filter (ratingAverage $gte 4)',
    build: (db) =>
      db
        .collection('products')
        .find({ status: 'published', ratingAverage: { $gte: 4 } })
        .sort({ createdAt: -1 })
        .limit(10),
  },
  {
    name: 'order.findRecentNonCancelledOrdersByUser (sorted)',
    build: (db, ids) =>
      db
        .collection('orders')
        .find({ userId: ids.userId, status: { $ne: 'cancelled' } })
        .project({ 'products.productId': 1 })
        .sort({ createdAt: -1 })
        .limit(10),
  },
  {
    name: 'order.aggregatePaidRevenueByShopId',
    build: (db, ids) =>
      db
        .collection('orders')
        .aggregate([{ $match: { shopId: ids.shopId, paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
  },
  {
    name: 'order.findOrdersContainingProduct',
    build: (db, ids) =>
      db
        .collection('orders')
        .find({ 'products.productId': ids.productId, status: { $ne: 'cancelled' } })
        .project({ 'products.productId': 1 })
        .limit(100),
  },
];

function printRow(stats) {
  console.log(`\n  ${stats.name}`);
  console.log(`    avg=${stats.avg.toFixed(2)}ms  median=${stats.median.toFixed(2)}ms  p95=${stats.p95.toFixed(2)}ms  min=${stats.min.toFixed(2)}ms  max=${stats.max.toFixed(2)}ms`);
  if (stats.explain) {
    const e = stats.explain;
    console.log(`    explain: stage=${e.winningStage || '?'} input=${e.inputStage || '-'} index=${e.indexName || '-'} keys=${e.totalKeysExamined} docs=${e.totalDocsExamined} execMs=${e.executionTimeMillis}`);
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log(`\n=== MongoDB Query Benchmark ===`);
  console.log(`iters=${ITERS}  explain=${SHOW_EXPLAIN}`);
  console.log(`database: ${db.databaseName}\n`);

  const ids = await fetchSampleIds(db);
  console.log('sample ids:', {
    product: ids.productId?.toString(),
    shop: ids.shopId?.toString(),
    category: ids.categoryId?.toString(),
    user: ids.userId?.toString(),
  });

  const results = [];
  for (const q of QUERIES) {
    if (!q.needsIds || (ids.productId && ids.shopId && ids.userId)) {
      const stats = await runQueryWithTiming(db, q.name, q.build, ids, ITERS);
      printRow(stats);
      results.push(stats);
    }
  }

  console.log('\n=== Summary ===');
  console.log('query'.padEnd(56), 'avg(ms)'.padStart(10), 'p95(ms)'.padStart(10), 'index'.padStart(20));
  for (const s of results) {
    const idx = s.explain?.indexName || '-';
    console.log(s.name.padEnd(56), s.avg.toFixed(2).padStart(10), s.p95.toFixed(2).padStart(10), idx.padStart(20));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('benchmark-queries error:', err?.message || err);
  process.exit(1);
});
