/**
 * Migration script to update products from isActive to status field
 * Run: node scripts/migrate-product-status.js
 */
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const productsCollection = db.collection("products");

    // Check current products
    const totalProducts = await productsCollection.countDocuments();
    console.log(`Total products in database: ${totalProducts}`);

    // Check products with status field
    const withStatus = await productsCollection.countDocuments({ status: { $exists: true } });
    console.log(`Products with status field: ${withStatus}`);

    // Check products with isActive field (old schema)
    const withIsActive = await productsCollection.countDocuments({ isActive: { $exists: true } });
    console.log(`Products with isActive field: ${withIsActive}`);

    // Check products with status = "published"
    const published = await productsCollection.countDocuments({ status: "published" });
    console.log(`Products with status="published": ${published}`);

    // Migration: Update products without status field
    // Set status based on isActive or default to "published"
    const result = await productsCollection.updateMany(
      { status: { $exists: false } },
      [
        {
          $set: {
            status: {
              $cond: {
                if: { $eq: ["$isActive", false] },
                then: "draft",
                else: "published"
              }
            }
          }
        }
      ]
    );

    console.log(`\nMigration completed:`);
    console.log(`- Matched: ${result.matchedCount}`);
    console.log(`- Modified: ${result.modifiedCount}`);

    // Verify after migration
    const afterMigration = await productsCollection.countDocuments({ status: "published" });
    console.log(`\nProducts with status="published" after migration: ${afterMigration}`);

    // Sample product to verify
    const sampleProduct = await productsCollection.findOne({});
    console.log("\nSample product fields:", Object.keys(sampleProduct || {}));

  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

migrate();
