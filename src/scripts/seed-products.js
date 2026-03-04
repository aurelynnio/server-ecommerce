/**
 * Script to seed Shops, Shop Categories, and Products
 * Usage:
 *   node src/scripts/seed-products.js
 *   node src/scripts/seed-products.js --quick
 *   node src/scripts/seed-products.js --shops 10 --products-per-shop 30
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

// Data Pools
const adjectives = [
  'Premium',
  'Ultra',
  'Lite',
  'Pro',
  'Max',
  'Super',
  'Smart',
  'Compact',
  'Gaming',
  'Office',
  'Classic',
  'Modern',
  'Vintage',
  'Luxury',
  'Essential',
  'Eco-friendly',
  'Wireless',
  'Digital',
  'Automatic',
  'Heavy-duty',
];
const nouns = [
  'Laptop',
  'Smartphone',
  'Headphones',
  'Keyboard',
  'Mouse',
  'Monitor',
  'Chair',
  'Desk',
  'Backpack',
  'Watch',
  'Shoes',
  'Jacket',
  'T-Shirt',
  'Jeans',
  'Dress',
  'Camera',
  'Lens',
  'Speaker',
  'Tablet',
  'Charger',
  'Cable',
  'Perfume',
  'Lipstick',
  'Serum',
  'Shampoo',
  'Sofa',
  'Bed',
  'Lamp',
  'Table',
  'Shelf',
];
const brands = [
  'Samsung',
  'Apple',
  'Sony',
  'LG',
  'Dell',
  'HP',
  'Asus',
  'Acer',
  'Lenovo',
  'Nike',
  'Adidas',
  'Puma',
  'Zara',
  'H&M',
  'Gucci',
  'Dior',
  'Chanel',
  "L'Oreal",
  'Dove',
  'Nivea',
  'IKEA',
  'Logitech',
  'Razer',
  'Corsair',
  'Canon',
  'Nikon',
  'JBL',
  'Bose',
];
const shopTypes = [
  'Tech Store',
  'Fashion Hub',
  'Beauty Bar',
  'Home Decor',
  'Gadget World',
  'Style Loft',
  'Digital Zone',
  'Green Life',
  'Kids Corner',
  'Sports Gear',
];
const defaultGlobalCategories = [
  { name: 'Điện thoại & Phụ kiện', slug: 'dien-thoai-phu-kien' },
  { name: 'Thời trang', slug: 'thoi-trang' },
  { name: 'Làm đẹp', slug: 'lam-dep' },
  { name: 'Nhà cửa & Đời sống', slug: 'nha-cua-doi-song' },
  { name: 'Máy tính & Thiết bị', slug: 'may-tinh-thiet-bi' },
  { name: 'Thể thao & Du lịch', slug: 'the-thao-du-lich' },
];

function parseArgInt(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const raw = process.argv[idx + 1];
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProductName() {
  const brand = getRandom(brands);
  const adj = getRandom(adjectives);
  const noun = getRandom(nouns);
  const modelCode = `${getRandom(['X', 'S', 'M', 'A', 'Z'])}${getRandomInt(10, 999)}`;
  const year = getRandomInt(2023, 2025);

  // Example: "Sony Ultra Headphones X500 2024"
  return `${brand} ${adj} ${noun} ${modelCode} ${year}`;
}

async function ensureGlobalCategories() {
  const globalCategories = await Category.find({ isActive: true }).select('_id');
  if (globalCategories.length > 0) return globalCategories;

  console.log('ℹ️ No global categories found. Creating default categories...');
  try {
    await Category.insertMany(
      defaultGlobalCategories.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: '',
        images: [],
        isActive: true,
      })),
      { ordered: false },
    );
  } catch (_e) {
    // Ignore duplicate key errors if categories were created concurrently or partially exist.
  }

  return await Category.find({ isActive: true }).select('_id');
}

async function resetSeedData() {
  console.log('⚠️ Reset enabled: deleting previously seeded data (safe scope)...');
  const seededUsers = await User.find({
    $or: [{ email: /@fake\.com$/i }, { username: /^seller_/i }],
  }).select('_id');
  const seededUserIds = seededUsers.map((u) => u._id);

  // Delete in dependency order
  await Product.deleteMany({});
  await ShopCategory.deleteMany({});
  await Shop.deleteMany({ owner: { $in: seededUserIds } });
  await User.deleteMany({ _id: { $in: seededUserIds } });
}

async function seedData() {
  const quick = hasFlag('--quick');
  const TOTAL_SHOPS = quick ? 5 : parseArgInt('--shops', 100);
  const PRODUCTS_PER_SHOP = quick ? 20 : parseArgInt('--products-per-shop', 50);
  const doReset = hasFlag('--reset');

  console.log(
    `🚀 Seeding: shops=${TOTAL_SHOPS}, products/shop=${PRODUCTS_PER_SHOP}, reset=${doReset}`,
  );

  try {
    // 1. Connect DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    if (doReset) {
      await resetSeedData();
    }

    // 2. Fetch/Create Global Categories
    const globalCategories = await ensureGlobalCategories();
    if (globalCategories.length === 0) {
      throw new Error(
        '❌ Failed to create global categories. Check unique constraints / DB permissions.',
      );
    }

    // 3. Pre-calculate password hash for speed
    const passwordHash = await bcrypt.hash('123456', 10);

    let totalProductsCreated = 0;

    console.log(`ℹ️ Creating ${TOTAL_SHOPS} Shops with ${PRODUCTS_PER_SHOP} products each...`);

    // Loop to create Shop + Owner + Categories + Products
    for (let i = 1; i <= TOTAL_SHOPS; i++) {
      const timestamp = Date.now();

      // A. Create Fake User (Shop Owner)
      const userEmail = `seller_${i}_${timestamp}@fake.com`;
      const username = `seller_${i}_${timestamp}`;

      const user = await User.create({
        username: username,
        email: userEmail,
        password: passwordHash,
        roles: 'seller', // Schema uses 'roles'
        isVerifiedEmail: true, // Schema uses 'isVerifiedEmail'
        provider: 'local',
      });

      // B. Create Shop
      const shopName = `${getRandom(shopTypes)} #${i} - ${crypto.randomBytes(2).toString('hex')}`;
      const shop = await Shop.create({
        name: shopName,
        slug: slugify(shopName, { lower: true, strict: true, locale: 'vi' }),
        description: `Official store for ${shopName}`,
        owner: user._id,
        status: 'active',
      });

      // Update user with shopId
      await User.findByIdAndUpdate(user._id, { shop: shop._id });

      // C. Create Shop Categories (3-5 per shop)
      const numCats = getRandomInt(3, 5);
      const shopCategoryIds = [];
      const catNames = [
        'New Arrivals',
        'Best Sellers',
        'Sale Off',
        'Premium Collection',
        'Accessories',
        'Summer vibes',
        'Winter Collection',
      ];

      for (let j = 0; j < numCats; j++) {
        const catName = catNames[j] || `Collection ${j + 1}`;
        const shopCat = await ShopCategory.create({
          shopId: shop._id,
          name: catName,
          isActive: true,
          displayOrder: j,
        });
        shopCategoryIds.push(shopCat._id);
      }

      // D. Create Products for this Shop
      const productsToInsert = [];

      for (let p = 0; p < PRODUCTS_PER_SHOP; p++) {
        const name = generateProductName() + ` [${i}-${p}]`; // Ensure absolute uniqueness
        const price = getRandomInt(100, 20000) * 1000;
        const now = new Date();
        const flashSaleEnabled = Math.random() > 0.9;
        const discountPercent = flashSaleEnabled ? getRandomInt(5, 30) : null;
        const salePrice =
          flashSaleEnabled && discountPercent
            ? Math.max(1000, Math.round(price * (1 - discountPercent / 100)))
            : null;

        productsToInsert.push({
          name: name,
          slug: slugify(name, { lower: true, strict: true, locale: 'vi' }),
          description: `Description for ${name}. High quality product from ${shopName}.`,
          shop: shop._id,
          shopCategory: getRandom(shopCategoryIds), // Assign to one of this shop's categories
          category: getRandom(globalCategories)._id, // Assign to a global category
          brand: name.split(' ')[0],
          price: {
            currentPrice: price,
            discountPrice: Math.random() > 0.5 ? Math.round(price * 0.9) : null,
            currency: 'VND',
          },
          stock: getRandomInt(5, 200),
          soldCount: getRandomInt(0, 500),
          status: 'published',
          isFeatured: Math.random() > 0.8,
          flashSale: flashSaleEnabled
            ? {
                isActive: true,
                salePrice,
                discountPercent,
                stock: getRandomInt(5, 50),
                soldCount: getRandomInt(0, 30),
                startTime: new Date(now.getTime() - 60 * 60 * 1000),
                endTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
              }
            : { isActive: false },
          variants: [
            {
              name: 'Standard',
              color: 'Black',
              price: price,
              stock: getRandomInt(5, 100),
              sku: `SKU-${shop._id.toString().slice(-4)}-${p}`,
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await Product.insertMany(productsToInsert);
      totalProductsCreated += productsToInsert.length;

      process.stdout.write(
        `\r✅ Shop ${i}/${TOTAL_SHOPS} created (${productsToInsert.length} products)`,
      );
    }

    console.log('\n');
    console.log(`🎉 DONE! Created ${TOTAL_SHOPS} Shops and ${totalProductsCreated} Products.`);
  } catch (error) {
    console.error('\n❌ Error seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected.');
  }
}

seedData();
