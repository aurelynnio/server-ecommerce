const mongoose = require("mongoose");
const path = require("path");
// Try to load env from root
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const connectDB = require("../db/connect.db");

// Import User model and helper
// Check if running from root or util folder, we use relative to this file
const User = require("../models/user.model");
const hashPassword = require("./hashPasword");
const logger = require("./logger");

const seedAdmin = async () => {
  try {
    logger.info("Connecting to DB...");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }
    await connectDB();
    logger.info("Database connected.");

    const email = "testadmin@gmail.com";
    const password = "123456";
    const username = "Test Admin";

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info("Test Admin user already exists. Updating credentials...");
      existingUser.password = hashPassword(password);
      existingUser.roles = "admin";
      existingUser.isVerifiedEmail = true;
      await existingUser.save();
    } else {
      logger.info("Creating new Test Admin user...");
      const hashedPassword = hashPassword(password);
      const newUser = new User({
        username,
        email,
        password: hashedPassword,
        roles: "admin",
        isVerifiedEmail: true,
        provider: "local",
      });
      await newUser.save();
    }

    // Verify immediately
    const verifyUser = await User.findOne({ email });
    logger.info("   --- Verification ---");
    logger.info("   Verify User found:", !!verifyUser);
    const comparePassword = require("../utils/comparePassword"); // Ensure this path is correct
    const match = comparePassword(password, verifyUser.password);
    logger.info("   Password Match in Seed Script:", match);
    logger.info("   Hashed Password in DB:", verifyUser.password);

    logger.info(`\n✅ SUCCESS: Admin Account Ready`);
    logger.info(`   Email: ${email}`);
    logger.info(`   Password: ${password}`);

    process.exit(0);
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();
