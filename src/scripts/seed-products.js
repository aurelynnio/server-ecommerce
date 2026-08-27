/**
 * Script to seed Shops, Shop Categories, and REAL Products
 *
 * Products come from a curated, real e-commerce dataset (real-products.json)
 * consolidated from open Amazon / Lazada / Shopee / Shein / Walmart samples.
 * No faker-generated product names or descriptions are used.
 *
 * Rebuild the dataset with:
 *   node src/scripts/build-real-dataset.js
 *
 * Usage:
 *   node src/scripts/seed-products.js
 *   node src/scripts/seed-products.js --reset
 */

require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Models
const Product = require('../models/product.model');
const Shop = require('../models/shop.model');
const Category = require('../models/category.model');
const ShopCategory = require('../models/shop.category.model');
const User = require('../models/user.model');

// Real product dataset
const realProducts = require('./data/real-products.json');

// Category slug -> Vietnamese label (must match dataset categorySlug + storefront slugs)
const GLOBAL_CATEGORIES = [
  { slug: 'dien-thoai-phu-kien', name: 'Điện thoại & Phụ kiện', description: 'Smartphones, phụ kiện, thiết bị di động' },
  { slug: 'thoi-trang', name: 'Thời trang', description: 'Quần áo, giày dép, phụ kiện thời trang' },
  { slug: 'lam-dep', name: 'Làm đẹp', description: 'Mỹ phẩm, dưỡng da, nước hoa' },
  { slug: 'nha-cua-doi-song', name: 'Nhà cửa & Đời sống', description: 'Nội thất, gia dụng, trang trí nhà' },
  { slug: 'may-tinh-thiet-bi', name: 'Máy tính & Thiết bị', description: 'Laptop, linh kiện, thiết bị điện tử' },
  { slug: 'the-thao-du-lich', name: 'Thể thao & Du lịch', description: 'Dụng cụ thể thao, thiết bị du lịch' },
  { slug: 'thuc-pham-do-uong', name: 'Thực phẩm & Đồ uống', description: 'Đồ ăn, thức uống, thực phẩm khô' },
];

const SHOP_TEMPLATES = {
  'dien-thoai-phu-kien': { name: 'MobileWorld Tech', suffix: 'Điện thoại & Phụ kiện' },
  'thoi-trang': { name: 'Style Hub Fashion', suffix: 'Thời trang' },
  'lam-dep': { name: 'Beauty Glow', suffix: 'Làm đẹp' },
  'nha-cua-doi-song': { name: 'HomeCasa Living', suffix: 'Nhà cửa & Đời sống' },
  'may-tinh-thiet-bi': { name: 'TechZone Computers', suffix: 'Máy tính & Thiết bị' },
  'the-thao-du-lich': { name: 'Active Sport Store', suffix: 'Thể thao & Du lịch' },
  'thuc-pham-do-uong': { name: 'FreshMart Food', suffix: 'Thực phẩm & Đồ uống' },
};

const SHOP_CATEGORY_NAMES = [
  'New Arrivals',
  'Best Sellers',
  'Flash Deals',
  'Phụ kiện',
  'Premium',
  'Sale Off',
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureGlobalCategories() {
  const existing = await Category.find({}).select('_id slug name');
  const bySlug = new Map(existing.map((c) => [c.slug, c]));

  const toCreate = [];
  for (const g of GLOBAL_CATEGORIES) {
    if (!bySlug.has(g.slug)) {
      toCreate.push({ name: g.name, slug: g.slug, description: g.description, images: [], isActive: true });
    }
  }
  if (toCreate.length) {
    await Category.insertMany(toCreate, { ordered: false }).catch(() => {});
  }

  return await Category.find({ slug: { $in: GLOBAL_CATEGORIES.map((g) => g.slug) } }).select(
    '_id slug name',
  );
}

function groupByCategory(products) {
  const groups = {};
  for (const p of products) {
    if (!groups[p.categorySlug]) groups[p.categorySlug] = [];
    groups[p.categorySlug].push(p);
  }
  return groups;
}

function buildVariants(item) {
  // Real products keep their real images; if the item has multiple colors we
  // still create a single representative variant so the flow matches the schema.
  const images = item.images && item.images.length ? item.images : [];
  const colors = item.colors && item.colors.length ? item.colors : ['Black'];
  const colorsList = colors.slice(0, 4);
  const basePrice = item.price.currentPrice || 0;
  return colorsList.map((color, idx) => {
    const priceBump =
      colorsList.length > 1 ? getRandomInt(-2, 8) * 10000 : 0;
    const price = Math.max(5000, basePrice + priceBump);
    return {
      name: color,
      color,
      price,
      stock: getRandomInt(5, 120),
      sold: item.soldCount || getRandomInt(0, 200),
      sku: `REAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
      images,
    };
  });
}

function buildDescription(item) {
  if (item.description && item.description.trim()) {
    let desc = item.description.trim();
    // Strip SHEIN promo boilerplate for cleaner copy when present.
    desc = desc.replace(/Free Returns ✓ Free Shipping✓\.\s*/gi, '');
    return desc.slice(0, 8000);
  }
  return `Chính hãng ${item.brand || ''} ${item.name}. Sản phẩm chất lượng cao, đóng gói cẩn thận, giao hàng nhanh.`;
}

async function resetSeedData() {
  console.log('⚠️ Reset enabled: removing previously seeded products, shops & sellers...');
  // Remove any shop-owner users that came from seeding (old faker seeds used
  // @seed.local / seller_*; the dataset seeder uses seller_real_*).
  const seededUsers = await User.find({
    $or: [{ email: /@seed\.local$/i }, { email: /@fake\.com$/i }, { username: /^seller_/i }],
  }).select('_id');
  const seededUserIds = seededUsers.map((u) => u._id);

  // Delete in dependency order
  await Product.deleteMany({});
  await ShopCategory.deleteMany({});
  await Shop.deleteMany({ owner: { $in: seededUserIds } });
  await User.deleteMany({ _id: { $in: seededUserIds } });
  await Shop.deleteMany({});
}

async function seedData() {
  const doReset = hasFlag('--reset');
  const products = realProducts;

  if (!products.length) {
    console.error('No real products found. Run `node src/scripts/build-real-dataset.js` first.');
    process.exit(1);
  }

  console.log(`🚀 Seeding ${products.length} REAL products from dataset...`);

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const categories = await ensureGlobalCategories();
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

    if (doReset) {
      await resetSeedData();
    }

    const passwordHash = await bcrypt.hash('123456', 10);
    const groups = groupByCategory(products);
    let totalProducts = 0;
    let shopIndex = 0;

    for (const [slug, groupProducts] of Object.entries(groups)) {
      const catDoc = categoryBySlug.get(slug);
      if (!catDoc) {
        console.warn(`  ! skip products with unknown category slug: ${slug}`);
        continue;
      }

      shopIndex++;
      const tpl = SHOP_TEMPLATES[slug] || { name: 'Store', suffix: slug };
      const timestamp = Date.now();
      const ownerEmail = `seller_real_${shopIndex}_${timestamp}@fake.com`;
      const username = `seller_real_${shopIndex}_${timestamp}`;

      const owner = await User.create({
        username,
        email: ownerEmail,
        password: passwordHash,
        roles: 'seller',
        isVerifiedEmail: true,
        provider: 'local',
      });

      const shopName = `${tpl.name} - ${tpl.suffix}`;
      const shop = await Shop.create({
        name: shopName,
        slug: slugify(shopName, { lower: true, strict: true, locale: 'vi' }),
        description: `Cửa hàng chính hãng chuyên ${tpl.suffix}.`,
        owner: owner._id,
        status: 'active',
      });
      await User.findByIdAndUpdate(owner._id, { shop: shop._id });

      const shopCategoryIds = [];
      for (let j = 0; j < Math.min(SHOP_CATEGORY_NAMES.length, 6); j++) {
        const sc = await ShopCategory.create({
          shopId: shop._id,
          name: SHOP_CATEGORY_NAMES[j],
          isActive: true,
          displayOrder: j,
        });
        shopCategoryIds.push(sc._id);
      }

      const toInsert = groupProducts.map((item, idx) => {
        const variants = buildVariants(item);
        const stock = variants.reduce((s, v) => s + v.stock, 0);
        const soldFromVariants = variants.reduce((s, v) => s + v.sold, 0);
        const images = item.images && item.images.length ? item.images : [];

        return {
          name: item.name,
          slug: slugify(`${item.name}-${crypto.randomBytes(2).toString('hex')}`, {
            lower: true,
            strict: true,
            locale: 'vi',
          }),
          description: buildDescription(item),
          shop: shop._id,
          shopCategory: getRandom(shopCategoryIds),
          category: catDoc._id,
          brand: item.brand || '',
          price: {
            currentPrice: item.price.currentPrice,
            discountPrice: null,
            currency: 'VND',
          },
          stock,
          soldCount: soldFromVariants,
          status: 'published',
          isFeatured: Math.random() > 0.8,
          isNewArrival: Math.random() > 0.85,
          flashSale: { isActive: false },
          variants,
          descriptionImages: images.slice(0, 10),
          sizes: item.sizes || [],
          weight: getRandomInt(100, 3000),
          dimensions: {
            height: getRandomInt(5, 60),
            width: getRandomInt(5, 60),
            length: getRandomInt(5, 60),
          },
          attributes: [
            { name: 'Thương hiệu', value: item.brand || 'Khác' },
            { name: 'Xuất xứ', value: item.origin ? 'Quốc tế' : 'Chính hãng' },
          ],
          ratingAverage: item.ratingAverage || 0,
          reviewCount: item.reviewCount || 0,
          createdAt: new Date(Date.now() - (shopIndex * 1000000 + idx) * 1000),
          updatedAt: new Date(),
        };
      });

      await Product.insertMany(toInsert);
      totalProducts += toInsert.length;
      console.log(`✅ Shop ${shopName}: ${toInsert.length} real products`);
    }

    console.log(`\n🎉 DONE! Created ${totalProducts} REAL products across ${shopIndex} shops.`);
  } catch (error) {
    console.error('\n❌ Error seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected.');
  }
}

seedData();