require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Voucher = require('../models/voucher.model');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);

  const now = new Date();
  console.log('--- VOUCHERS ---');
  const allVouchers = await Voucher.find({}).lean();
  console.log('Total vouchers:', allVouchers.length);
  const activeVouchers = await Voucher.find({
    isActive: true,
    endDate: { $gte: now },
  }).lean();
  console.log('Active (non-expired) vouchers right now:', activeVouchers.length);

  console.log('\n--- FLASH SALE PRODUCTS ---');
  const totalProducts = await Product.countDocuments();
  console.log('Total products:', totalProducts);
  const withFlashSale = await Product.countDocuments({ flashSale: { $exists: true, $ne: null } });
  console.log('With flashSale object:', withFlashSale);
  const activeFlashSale = await Product.countDocuments({ 'flashSale.isActive': true });
  console.log('With flashSale.isActive=true:', activeFlashSale);

  const sampleFlash = await Product.find({ 'flashSale.isActive': true })
    .select('name slug status flashSale')
    .limit(5)
    .lean();
  console.log('Sample flash sale products:');
  for (const p of sampleFlash) {
    console.log({
      name: p.name,
      status: p.status,
      isActive: p.flashSale?.isActive,
      startTime: p.flashSale?.startTime,
      endTime: p.flashSale?.endTime,
      isCurrentlyRunning: p.flashSale?.startTime <= now && p.flashSale?.endTime >= now,
    });
  }

  const currentlyRunningFlash = await Product.countDocuments({
    status: 'published',
    'flashSale.isActive': true,
    'flashSale.startTime': { $lte: now },
    'flashSale.endTime': { $gte: now },
  });
  console.log(
    '\nCurrently running flash sale products (startTime <= now <= endTime):',
    currentlyRunningFlash,
  );

  await mongoose.disconnect();
}

check();
