
const mongoose = require("mongoose");
const path = require("path");
// Try to load env from root
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const connectDB = require("../db/connect.db");

// Import User model and helper
// Check if running from root or util folder, we use relative to this file
const User = require("../models/user.model");
const hashPassword = require("./hashPasword"); 

const seedAdmin = async () => {
    try {
        console.log("Connecting to DB...");
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing in .env");
        }
        await connectDB();
        console.log("Database connected.");

        const email = "testadmin@gmail.com";
        const password = "123456";
        const username = "Test Admin";

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("Test Admin user already exists. Updating credentials...");
            existingUser.password = hashPassword(password);
            existingUser.roles = "admin";
            existingUser.isVerifiedEmail = true;
            await existingUser.save();
        } else {
            console.log("Creating new Test Admin user...");
            const hashedPassword = hashPassword(password);
            const newUser = new User({
                username,
                email,
                password: hashedPassword,
                roles: "admin",
                isVerifiedEmail: true,
                provider: "local"
            });
            await newUser.save();
        }

        // Verify immediately
        const verifyUser = await User.findOne({ email });
        console.log("   --- Verification ---");
        console.log("   Verify User found:", !!verifyUser);
        const comparePassword = require("../utils/comparePassword"); // Ensure this path is correct
        const match = comparePassword(password, verifyUser.password);
        console.log("   Password Match in Seed Script:", match);
        console.log("   Hashed Password in DB:", verifyUser.password);

        console.log(`\n✅ SUCCESS: Admin Account Ready`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedAdmin();
