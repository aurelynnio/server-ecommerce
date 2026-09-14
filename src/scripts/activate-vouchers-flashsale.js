require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Voucher = require('../models/voucher.model');
const redisService = require('../services/redis.service');

function pickRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function activate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // 1. Activate all platform vouchers
  console.log('\n[1/3] Activating vouchers...');
  const voucherUpdateResult = await Voucher.updateMany(
    { scope: 'platform' },
    {
      $set: {
        isActive: true,
        startDate: twoHoursAgo,
        endDate: oneYearLater,
      },
    },
  );
  console.log(
    `Updated ${voucherUpdateResult.modifiedCount} vouchers with new validity window: ${twoHoursAgo.toISOString()} -> ${oneYearLater.toISOString()}`,
  );

  const activeVouchers = await Voucher.find({
    scope: 'platform',
    isActive: true,
    endDate: { $gte: now },
  }).lean();
  console.log(`Active platform vouchers now in DB: ${activeVouchers.length}`);

  // 2. Activate Flash Sale on 50 published products
  console.log('\n[2/3] Activating Flash Sale products...');
  // Find published products with valid currentPrice
  const candidateProducts = await Product.find({
    status: 'published',
    'price.currentPrice': { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .limit(80)
    .select('_id name slug price variants stock');

  console.log(`Found ${candidateProducts.length} candidate products for flash sale`);

  const selected = candidateProducts.slice(0, 50);
  let flashActivated = 0;

  for (const product of selected) {
    const currentPrice = product.price?.currentPrice || 0;
    if (currentPrice <= 0) continue;

    const discountPercent = pickRandom(15, 50);
    const salePrice = Math.round((currentPrice * (1 - discountPercent / 100)) / 1000) * 1000;
    const stock = pickRandom(50, 300);
    const soldCount = pickRandom(5, 45);

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          'price.discountPrice': salePrice,
          onSale: true,
          flashSale: {
            isActive: true,
            salePrice,
            discountPercent,
            stock,
            soldCount,
            startTime: twoHoursAgo,
            endTime: thirtyDaysLater,
          },
        },
      },
    );
    flashActivated++;
  }

  console.log(
    `Activated flash sale on ${flashActivated} products (valid until ${thirtyDaysLater.toISOString()})`,
  );

  // 3. Clear Redis cache
  console.log('\n[3/3] Clearing Redis cache...');
  try {
    await redisService.delByPattern('flash-sale:*');
    await redisService.delByPattern('voucher:*');
    console.log('Redis cache cleared successfully.');
  } catch (err) {
    console.warn('Redis cache clear warning:', err.message);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

activate().catch((err) => {
  console.error('Error activating:', err);
  process.exit(1);
});
