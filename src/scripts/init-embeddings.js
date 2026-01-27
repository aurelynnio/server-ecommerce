/**
 * Script to initialize product embeddings
 * Run this once to generate embeddings for all products
 * 
 * Usage: node src/scripts/init-embeddings.js [--force]
 * 
 * Options:
 *   --force    Re-embed all products even if they already have embeddings
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { embedAllProducts, createVectorSearchIndex } = require("../services/embedding.service");

async function main() {
  const force = process.argv.includes("--force");
  
  console.log("=== Product Embeddings Initialization ===");
  console.log(`Force re-embed: ${force}`);
  console.log("");
  
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    console.log("");
    
    // Try to create vector search index (may fail if not Atlas M10+)
    console.log("Checking/Creating vector search index...");
    const indexCreated = await createVectorSearchIndex();
    if (!indexCreated) {
      console.log("Warning: Vector search index could not be created programmatically.");
      console.log("You may need to create it manually via MongoDB Atlas UI.");
      console.log("The system will fall back to text search until the index is created.");
      console.log("");
    }
    
    // Generate embeddings for all products
    console.log("Starting embedding generation...");
    console.log("");
    
    const startTime = Date.now();
    const stats = await embedAllProducts({ batchSize: 10, force });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log("");
    console.log("=== Embedding Complete ===");
    console.log(`  Success: ${stats.success}`);
    console.log(`  Failed:  ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Time:    ${duration}s`);
    console.log("");
    
    if (stats.failed > 0) {
      console.log("Some products failed to embed. Check the logs for details.");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

main();
