/**
 * Script to seed 100 Shops, Shop Categories, and 5000 Products
 * Usage: node src/scripts/seed-products.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const slugify = require("slugify");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Models
const Product = require("../models/product.model");
const Shop = require("../models/shop.model");
const Category = require("../models/category.model");
const ShopCategory = require("../models/shop.category.model");
const User = require("../models/user.model");

// Data Pools
const adjectives = ["Premium", "Ultra", "Lite", "Pro", "Max", "Super", "Smart", "Compact", "Gaming", "Office", "Classic", "Modern", "Vintage", "Luxury", "Essential", "Eco-friendly", "Wireless", "Digital", "Automatic", "Heavy-duty"];
const nouns = ["Laptop", "Smartphone", "Headphones", "Keyboard", "Mouse", "Monitor", "Chair", "Desk", "Backpack", "Watch", "Shoes", "Jacket", "T-Shirt", "Jeans", "Dress", "Camera", "Lens", "Speaker", "Tablet", "Charger", "Cable", "Perfume", "Lipstick", "Serum", "Shampoo", "Sofa", "Bed", "Lamp", "Table", "Shelf"];
const brands = ["Samsung", "Apple", "Sony", "LG", "Dell", "HP", "Asus", "Acer", "Lenovo", "Nike", "Adidas", "Puma", "Zara", "H&M", "Gucci", "Dior", "Chanel", "L'Oreal", "Dove", "Nivea", "IKEA", "Logitech", "Razer", "Corsair", "Canon", "Nikon", "JBL", "Bose"];
const shopTypes = ["Tech Store", "Fashion Hub", "Beauty Bar", "Home Decor", "Gadget World", "Style Loft", "Digital Zone", "Green Life", "Kids Corner", "Sports Gear"];

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
  const modelCode = `${getRandom(["X", "S", "M", "A", "Z"])}${getRandomInt(10, 999)}`;
  const year = getRandomInt(2023, 2025);
  
  // Example: "Sony Ultra Headphones X500 2024"
  return `${brand} ${adj} ${noun} ${modelCode} ${year}`;
}

async function seedData() {
  console.log("🚀 Starting MASSIVE seeding (100 Shops, 5000 Products)...");

  try {
    // 1. Connect DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // 2. Fetch Global Categories (Must exist)
    const globalCategories = await Category.find({ isActive: true }).select("_id");
    if (globalCategories.length === 0) {
      throw new Error("❌ No global categories found. Please create some first.");
    }

    // 3. Pre-calculate password hash for speed
    const passwordHash = await bcrypt.hash("123456", 10);

    const TOTAL_SHOPS = 100;
    const PRODUCTS_PER_SHOP = 50; // Total 5000
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
        roles: "seller", // Schema uses 'roles'
        isVerifiedEmail: true, // Schema uses 'isVerifiedEmail'
        status: "active", // Note: Schema doesn't have 'status', might be ignored or handled by default
        provider: "local"
      });

      // B. Create Shop
      const shopName = `${getRandom(shopTypes)} #${i} - ${crypto.randomBytes(2).toString('hex')}`;
      const shop = await Shop.create({
        name: shopName,
        slug: slugify(shopName, { lower: true, strict: true, locale: 'vi' }),
        description: `Official store for ${shopName}`,
        owner: user._id,
        status: "active",
        email: userEmail,
        phone: `09${getRandomInt(10000000, 99999999)}`
      });

      // Update user with shopId
      await User.findByIdAndUpdate(user._id, { shop: shop._id });

      // C. Create Shop Categories (3-5 per shop)
      const numCats = getRandomInt(3, 5);
      const shopCategoryIds = [];
      const catNames = ["New Arrivals", "Best Sellers", "Sale Off", "Premium Collection", "Accessories", "Summer vibes", "Winter Collection"];
      
      for (let j = 0; j < numCats; j++) {
        const catName = catNames[j] || `Collection ${j+1}`;
        const shopCat = await ShopCategory.create({
          shopId: shop._id,
          name: catName,
          isActive: true,
          displayOrder: j
        });
        shopCategoryIds.push(shopCat._id);
      }

      // D. Create Products for this Shop
      const productsToInsert = [];
      
      for (let p = 0; p < PRODUCTS_PER_SHOP; p++) {
        const name = generateProductName() + ` [${i}-${p}]`; // Ensure absolute uniqueness
        const price = getRandomInt(100, 20000) * 1000;
        
        productsToInsert.push({
          name: name,
          slug: slugify(name, { lower: true, strict: true, locale: "vi" }),
          description: `Description for ${name}. High quality product from ${shopName}.`,
          shop: shop._id,
          shopCategory: getRandom(shopCategoryIds), // Assign to one of this shop's categories
          category: getRandom(globalCategories)._id, // Assign to a global category
          brand: name.split(" ")[0],
          price: {
            currentPrice: price,
            discountPrice: Math.random() > 0.5 ? Math.round(price * 0.9) : null,
            currency: "VND"
          },
          stock: getRandomInt(5, 200),
          soldCount: getRandomInt(0, 500),
          status: "published",
          isFeatured: Math.random() > 0.8,
          variants: [
            {
              name: "Standard",
              color: "Black",
              price: price,
              stock: getRandomInt(5, 100),
              sku: `SKU-${shop._id.toString().slice(-4)}-${p}`
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await Product.insertMany(productsToInsert);
      totalProductsCreated += productsToInsert.length;
      
      process.stdout.write(`\r✅ Shop ${i}/${TOTAL_SHOPS} created (${productsToInsert.length} products)`);
    }

    console.log("\n");
    console.log(`🎉 DONE! Created ${TOTAL_SHOPS} Shops and ${totalProductsCreated} Products.`);
    
  } catch (error) {
    console.error("\n❌ Error seeding:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected.");
  }
}

seedData();
