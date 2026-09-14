require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user.model');

async function createAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB successfully.');

    // Check existing admins
    const existingAdmins = await User.find({ roles: 'admin' }).select(
      'username email roles isVerifiedEmail',
    );
    console.log('Existing admin accounts in DB:', existingAdmins);

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@aura.com';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    let user = await User.findOne({
      $or: [{ email: adminEmail }, { username: adminUsername }],
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (user) {
      console.log(
        `Found existing user with email ${user.email} or username ${user.username}. Updating to admin role and setting password...`,
      );
      user.roles = 'admin';
      user.password = hashedPassword;
      user.isVerifiedEmail = true;
      user.provider = 'local';
      if (!user.username) user.username = adminUsername;
      await user.save();
      console.log(`Admin account updated successfully:`);
    } else {
      console.log(`Creating new admin account: ${adminEmail} / ${adminUsername}...`);
      user = await User.create({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        roles: 'admin',
        isVerifiedEmail: true,
        provider: 'local',
      });
      console.log(`Admin account created successfully:`);
    }

    console.log('==============================================');
    console.log('ADMIN CREDENTIALS:');
    console.log(`  Username : ${user.username}`);
    console.log(`  Email    : ${user.email}`);
    console.log(`  Password : ${adminPassword}`);
    console.log(`  Role     : ${user.roles}`);
    console.log(`  Verified : ${user.isVerifiedEmail}`);
    console.log('==============================================');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin account:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

createAdmin();
