/**
 * Script: Cleanup All Products
 * 
 * Mục đích: Xóa toàn bộ sản phẩm và dữ liệu liên quan để chuẩn bị cho
 * hệ thống multi-shop (nhiều shop bán cho nhiều người mua)
 * 
 * Dữ liệu sẽ bị xóa:
 * - Products (tất cả sản phẩm)
 * - Reviews (đánh giá sản phẩm)
 * - Cart items chứa sản phẩm
 * - Wishlist items chứa sản phẩm
 * - Order items (tùy chọn - mặc định không xóa để giữ lịch sử)
 * 
 * Cách chạy:
 *   node scripts/cleanup-all-products.js
 * 
 * Với xác nhận tự động (NGUY HIỂM):
 *   node scripts/cleanup-all-products.js --force
 * 
 * Xóa cả orders (NGUY HIỂM):
 *   node scripts/cleanup-all-products.js --include-orders
 */

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");
const connectDB = require("../src/db/connect.db");

// Import models
const Product = require("../src/models/product.model");
const Review = require("../src/models/review.model");
const Cart = require("../src/models/cart.model");

// Check for optional models
let Wishlist, Order;
try {
  // Wishlist might be embedded in User model or separate
  const User = require("../src/models/user.model");
  Wishlist = User; // Will handle wishlist through User model
} catch (e) {
  console.log("Note: Wishlist model not found separately");
}

try {
  Order = require("../src/models/order.model");
} catch (e) {
  console.log("Note: Order model not found");
}

// Parse command line arguments
const args = process.argv.slice(2);
const forceMode = args.includes("--force");
const includeOrders = args.includes("--include-orders");
const dryRun = args.includes("--dry-run");

// Helper function to prompt user
const askQuestion = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
};

// Main cleanup function
const cleanupProducts = async () => {
  console.log("\n========================================");
  console.log("   PRODUCT CLEANUP SCRIPT");
  console.log("========================================\n");

  try {
    // Connect to database
    await connectDB();
    console.log("✓ Database connected\n");

    // Count existing data
    const productCount = await Product.countDocuments({});
    const reviewCount = await Review.countDocuments({});
    const cartCount = await Cart.countDocuments({});
    
    let orderCount = 0;
    if (Order && includeOrders) {
      orderCount = await Order.countDocuments({});
    }

    console.log("Current data in database:");
    console.log(`  - Products: ${productCount}`);
    console.log(`  - Reviews: ${reviewCount}`);
    console.log(`  - Carts: ${cartCount}`);
    if (includeOrders) {
      console.log(`  - Orders: ${orderCount}`);
    }
    console.log("");

    if (productCount === 0) {
      console.log("✓ No products to delete. Database is already clean.");
      process.exit(0);
    }

    // Dry run mode
    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No data will be deleted");
      console.log("\nWould delete:");
      console.log(`  - ${productCount} products`);
      console.log(`  - ${reviewCount} reviews`);
      console.log(`  - ${cartCount} carts (items will be cleared)`);
      if (includeOrders) {
        console.log(`  - ${orderCount} orders`);
      }
      process.exit(0);
    }

    // Confirmation
    if (!forceMode) {
      console.log("⚠️  WARNING: This action is IRREVERSIBLE!");
      console.log("   All products and related data will be permanently deleted.\n");
      
      const answer = await askQuestion("Type 'DELETE ALL' to confirm: ");
      
      if (answer !== "delete all") {
        console.log("\n❌ Operation cancelled.");
        process.exit(0);
      }
    }

    console.log("\n🗑️  Starting cleanup...\n");

    // 1. Delete all reviews
    console.log("Deleting reviews...");
    const reviewResult = await Review.deleteMany({});
    console.log(`  ✓ Deleted ${reviewResult.deletedCount} reviews`);

    // 2. Clear all cart items
    console.log("Clearing cart items...");
    const cartResult = await Cart.updateMany(
      {},
      { $set: { items: [], totalPrice: 0, totalItems: 0 } }
    );
    console.log(`  ✓ Cleared ${cartResult.modifiedCount} carts`);

    // 3. Clear wishlist from users (if wishlist is in User model)
    if (Wishlist) {
      console.log("Clearing wishlists...");
      try {
        const wishlistResult = await Wishlist.updateMany(
          {},
          { $set: { wishlist: [] } }
        );
        console.log(`  ✓ Cleared ${wishlistResult.modifiedCount} wishlists`);
      } catch (e) {
        console.log("  ⚠ Wishlist field not found in User model, skipping...");
      }
    }

    // 4. Delete orders (optional)
    if (Order && includeOrders) {
      console.log("Deleting orders...");
      const orderResult = await Order.deleteMany({});
      console.log(`  ✓ Deleted ${orderResult.deletedCount} orders`);
    }

    // 5. Delete all products
    console.log("Deleting products...");
    const productResult = await Product.deleteMany({});
    console.log(`  ✓ Deleted ${productResult.deletedCount} products`);

    // Summary
    console.log("\n========================================");
    console.log("   CLEANUP COMPLETE");
    console.log("========================================");
    console.log("\nDeleted:");
    console.log(`  - ${productResult.deletedCount} products`);
    console.log(`  - ${reviewResult.deletedCount} reviews`);
    console.log(`  - Cleared ${cartResult.modifiedCount} carts`);
    if (includeOrders && Order) {
      console.log(`  - ${orderCount} orders`);
    }
    console.log("\n✓ Database is now ready for multi-shop products!\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run the script
cleanupProducts();
