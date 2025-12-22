const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  return await mongoose
    .connect(uri, {
      maxConnecting: 10,
      maxPoolSize: 10,
    })
    .then(() => {
      console.log(
        `MongoDB connected: ${
          uri.includes("srv") ? "Atlas (Cloud)" : "Localhost"
        }`
      );
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error);
      process.exit(1);
    });
};

module.exports = connectDB;
