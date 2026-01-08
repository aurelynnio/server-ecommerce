/**
 * Script to remove the 'images' field from all products
 * Product images are now stored in variants[].images only
 * 
 * Run: node scripts/remove-product-images-field.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function removeImagesField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const productsCollection = db.collection("products");

    // Count products with images field
    const countWithImages = await productsCollection.countDocuments({ images: { $exists: true } });
    console.log(`Found ${countWithImages} products with 'images' field`);

    if (countWithImages === 0) {
      console.log("No products to update");
      return;
    }

    // Remove images field from all products
    const result = await productsCollection.updateMany(
      { images: { $exists: true } },
      { $unset: { images: "" } }
    );

    console.log(`Updated ${result.modifiedCount} products`);
    console.log("Successfully removed 'images' field from all products");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

removeImagesField();
