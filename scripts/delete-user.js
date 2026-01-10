const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../src/models/user.model");

const deleteUser = async () => {
  const email = "quocanhlove194@gmail.com";

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find and delete user
    const result = await User.deleteOne({ email });

    if (result.deletedCount === 1) {
      console.log(`Successfully deleted user with email: ${email}`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  } catch (error) {
    console.error("Error deleting user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit();
  }
};

deleteUser();
