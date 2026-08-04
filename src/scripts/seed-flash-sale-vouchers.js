/**
 * Seed bổ sung: Flash Sale active + Platform Vouchers + product rating/soldCount
 *
 * Idempotent: chạy lại nhiều lần vẫn OK
 *   - Reset flashSale cho N sản phẩm published (xóa cũ trước khi set mới)
 *   - Xóa platform vouchers cũ (theo prefix code "GIAM"/"SAVE"/"DEAL") rồi insert mới
 *   - Update ratingAverage/soldCount/reviewCount cho products chưa có stats
 *
 * Usage:
 *   node src/scripts/seed-flash-sale-vouchers.js
 *   node src/scripts/seed-flash-sale-vouchers.js --flash-count 50
 */

require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Voucher = require('../models/voucher.model');

function parseArgInt(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const raw = process.argv[idx + 1];
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pickRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickFloat(min, max, precision = 1) {
  const val = Math.random() * (max - min) + min;
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}

// Voucher templates — Tmall/JD-style platform vouchers
const voucherTemplates = [
  // Fixed amount vouchers
  { code: 'GIAM20K', name: 'Giảm 20K', description: 'Giảm 20,000đ cho đơn từ 200K', type: 'fixed_amount', value: 20000, maxValue: null, minOrderValue: 200000 },
  { code: 'GIAM50K', name: 'Giảm 50K', description: 'Giảm 50,000đ cho đơn từ 500K', type: 'fixed_amount', value: 50000, maxValue: null, minOrderValue: 500000 },
  { code: 'GIAM100K', name: 'Giảm 100K', description: 'Giảm 100,000đ cho đơn từ 1 triệu', type: 'fixed_amount', value: 100000, maxValue: null, minOrderValue: 1000000 },
  { code: 'GIAM200K', name: 'Giảm 200K', description: 'Giảm 200,000đ cho đơn từ 2 triệu', type: 'fixed_amount', value: 200000, maxValue: null, minOrderValue: 2000000 },
  { code: 'GIAM500K', name: 'Giảm 500K Mega', description: 'Giảm 500,000đ cho đơn từ 5 triệu', type: 'fixed_amount', value: 500000, maxValue: null, minOrderValue: 5000000 },
  { code: 'NEWORDER30K', name: 'Đơn đầu tiên 30K', description: 'Giảm 30,000đ cho đơn hàng đầu tiên', type: 'fixed_amount', value: 30000, maxValue: null, minOrderValue: 150000 },
  // Percentage vouchers
  { code: 'SAVE5', name: 'Giảm 5%', description: 'Giảm 5% tối đa 30K', type: 'percentage', value: 5, maxValue: 30000, minOrderValue: 100000 },
  { code: 'SAVE10', name: 'Giảm 10%', description: 'Giảm 10% tối đa 80K', type: 'percentage', value: 10, maxValue: 80000, minOrderValue: 300000 },
  { code: 'SAVE15', name: 'Giảm 15%', description: 'Giảm 15% tối đa 150K', type: 'percentage', value: 15, maxValue: 150000, minOrderValue: 500000 },
  { code: 'SAVE20', name: 'Giảm 20%', description: 'Giảm 20% tối đa 250K', type: 'percentage', value: 20, maxValue: 250000, minOrderValue: 800000 },
  { code: 'DEAL12', name: 'Deal sốc 12%', description: 'Giảm 12% tối đa 100K', type: 'percentage', value: 12, maxValue: 100000, minOrderValue: 400000 },
  { code: 'MEGA25', name: 'Mega Sale 25%', description: 'Giảm 25% tối đa 500K', type: 'percentage', value: 25, maxValue: 500000, minOrderValue: 1500000 },
];

async function publishAllProducts() {
  console.log('\n[0/3] Publishing all non-deleted products...');
  const result = await Product.updateMany(
    { status: { $ne: 'deleted' } },
    { $set: { status: 'published' } },
  );
  console.log(`  Published ${result.modifiedCount} products (was draft/suspended/published)`);
  return result.modifiedCount;
}

async function seedFlashSale(flashCount) {
  console.log(`\n[1/3] Seeding Flash Sale for ${flashCount} products...`);

  // Clear existing flashSale on all products
  const clearResult = await Product.updateMany(
    { 'flashSale.isActive': true },
    { $set: { 'flashSale.isActive': false, 'flashSale.startTime': null, 'flashSale.endTime': null } },
  );
  console.log(`  Cleared ${clearResult.modifiedCount} existing flash sale flags`);

  // Pick random published products with valid price
  const products = await Product.find({
    status: 'published',
    'price.currentPrice': { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .limit(flashCount * 2) // get more than needed for random pick
    .select('_id price.currentPrice slug name');

  if (products.length === 0) {
    console.log('  No published products found, skipping flash sale');
    return 0;
  }

  // Shuffle and pick N
  const shuffled = products.sort(() => Math.random() - 0.5).slice(0, Math.min(flashCount, products.length));

  const now = new Date();
  const startTime = new Date(now.getTime() - 60 * 60 * 1000); // started 1h ago
  const endTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // ends in 2 days

  let updated = 0;
  for (const product of shuffled) {
    const currentPrice = product.price?.currentPrice || 0;
    if (currentPrice <= 0) continue;

    const discountPercent = pickRandom(15, 45);
    const salePrice = Math.round(currentPrice * (1 - discountPercent / 100) / 1000) * 1000; // round to 1000
    const stock = pickRandom(30, 200);
    const soldCount = pickRandom(2, 80);

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          flashSale: {
            isActive: true,
            salePrice,
            discountPercent,
            stock,
            soldCount,
            startTime,
            endTime,
          },
        },
      },
    );
    updated++;
  }

  console.log(`  Activated flash sale for ${updated} products (valid window: ${startTime.toISOString()} → ${endTime.toISOString()})`);
  return updated;
}

async function seedVouchers() {
  console.log(`\n[2/3] Seeding ${voucherTemplates.length} platform vouchers...`);

  // Delete existing platform vouchers with our code prefixes (idempotent)
  const deleteResult = await Voucher.deleteMany({
    scope: 'platform',
    code: { $in: voucherTemplates.map((v) => v.code) },
  });
  console.log(`  Deleted ${deleteResult.deletedCount} existing platform vouchers`);

  const now = new Date();
  const startDate = new Date(now.getTime() - 60 * 60 * 1000); // started 1h ago
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const docs = voucherTemplates.map((tpl) => ({
    code: tpl.code,
    name: tpl.name,
    description: tpl.description,
    type: tpl.type,
    value: tpl.value,
    maxValue: tpl.maxValue,
    scope: 'platform',
    shopId: null,
    minOrderValue: tpl.minOrderValue,
    usageLimit: 1000,
    usageCount: pickRandom(50, 800),
    usageLimitPerUser: 1,
    startDate,
    endDate,
    isActive: true,
  }));

  await Voucher.insertMany(docs);
  console.log(`  Inserted ${docs.length} platform vouchers (valid until ${endDate.toISOString().slice(0, 10)})`);
  return docs.length;
}

async function updateProductStats() {
  console.log('\n[3/3] Updating product rating/soldCount/reviewCount + isNewArrival flag...');

  // Set isNewArrival: true for 30 most recent products (for Hàng mới về section)
  const newProducts = await Product.find({ status: 'published' })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('_id');
  const newIds = newProducts.map((p) => p._id);
  await Product.updateMany({ _id: { $in: newIds } }, { $set: { isNewArrival: true } });
  await Product.updateMany({ _id: { $nin: newIds } }, { $set: { isNewArrival: false } });
  console.log(`  Marked ${newIds.length} products as isNewArrival`);

  // Update stats for ALL published products (force update, not just missing)
  const products = await Product.find({ status: 'published' }).select('_id');
  console.log(`  Updating stats for ${products.length} products...`);

  let updated = 0;
  for (const product of products) {
    const ratingAverage = pickFloat(4.0, 5.0, 1);
    const reviewCount = pickRandom(8, 250);
    const soldCount = pickRandom(30, 2500);

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          ratingAverage,
          reviewCount,
          soldCount,
        },
      },
    );
    updated++;
  }

  console.log(`  Updated stats for ${updated} products (rating 4.0-5.0, reviews 8-250, sold 30-2500)`);
  return updated;
}

async function main() {
  console.log('=== Seed Flash Sale + Vouchers + Product Stats ===');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not set in .env');
    process.exit(1);
  }

  const flashCount = parseArgInt('--flash-count', 40);

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB: ${uri.split('@')[1]?.split('/')[0] || 'atlas'}`);

  await publishAllProducts();
  const flashUpdated = await seedFlashSale(flashCount);
  const voucherInserted = await seedVouchers();
  const statsUpdated = await updateProductStats();

  console.log('\n=== Summary ===');
  console.log(`  Flash Sale activated: ${flashUpdated} products`);
  console.log(`  Platform vouchers: ${voucherInserted} inserted`);
  console.log(`  Product stats updated: ${statsUpdated} products`);
  console.log('\nDone! Refresh http://localhost:3000 to see updates.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
