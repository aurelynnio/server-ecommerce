require("dotenv").config();
const connectDB = require("../src/db/connect.db");
const Product = require("../src/models/product.model");
const fs = require("fs");
const path = require("path");

const run = async () => {
  try {
    await connectDB();
    const products = await Product.find({});
    
    const outputPath = path.join(__dirname, "products.json");
    fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), "utf-8");
    
    console.log(`Exported ${products.length} products to ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
