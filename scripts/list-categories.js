require("dotenv").config();
const connectDB = require("../src/db/connect.db");
const Category = require("../src/models/category.model");
const fs = require("fs");
const path = require("path");

const run = async () => {
  try {
    await connectDB();
    const categories = await Category.find({});
    
    const outputPath = path.join(__dirname, "categories.json");
    fs.writeFileSync(outputPath, JSON.stringify(categories, null, 2), "utf-8");
    
    console.log(`Exported ${categories.length} categories to ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
