require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.resolve(__dirname, '../../users.csv');

async function run() {
  console.log('1. Reading users from users.csv...');
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`File not found: ${CSV_PATH}`);
  }

  const fileContent = fs.readFileSync(CSV_PATH, 'utf8').trim();
  const lines = fileContent.split('\n').filter(Boolean);
  const rawData = lines.slice(1).map((line) => {
    const [email, password] = line.trim().split(',');
    return { email: email.trim(), password: password.trim() };
  });

  console.log(`Found ${rawData.length} users in CSV.`);
  if (rawData.length !== 1000) {
    console.warn(`Warning: expected 1000 users, found ${rawData.length}`);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('2. Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('MongoDB connected successfully.');

  const User = mongoose.model(
    'User',
    new mongoose.Schema(
      {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        roles: { type: String, default: 'user' },
        isVerifiedEmail: { type: Boolean, default: true },
        isTwoFactorEnabled: { type: Boolean, default: false },
        provider: { type: String, default: 'local' },
        addresses: { type: Array, default: [] },
        permissions: { type: Array, default: [] },
      },
      { timestamps: true, collection: 'users' },
    ),
  );

  console.log('3. Hashing passwords and preparing user documents...');
  const batchSize = 50;
  const docs = [];
  const passwordMap = new Map();

  for (let i = 0; i < rawData.length; i += batchSize) {
    const chunk = rawData.slice(i, i + batchSize);
    const hashedChunk = await Promise.all(
      chunk.map(async ({ email, password }) => {
        passwordMap.set(email, password);
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
        const hashedPassword = await bcrypt.hash(password, 10);
        return {
          username,
          email,
          password: hashedPassword,
          roles: 'user',
          isVerifiedEmail: true,
          isTwoFactorEnabled: false,
          provider: 'local',
          addresses: [],
          permissions: [],
        };
      }),
    );
    docs.push(...hashedChunk);
    process.stdout.write(`  Hashed ${docs.length}/${rawData.length} passwords\r`);
  }
  console.log(`\nAll ${docs.length} passwords hashed successfully.`);

  console.log('4. Inserting/updating users in MongoDB Atlas...');
  const bulkOps = docs.map((doc) => ({
    updateOne: {
      filter: { email: doc.email },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const bulkResult = await User.bulkWrite(bulkOps, { ordered: false });
  console.log('Bulk write completed:');
  console.log(`  Matched: ${bulkResult.matchedCount}`);
  console.log(`  Modified: ${bulkResult.modifiedCount}`);
  console.log(`  Upserted: ${bulkResult.upsertedCount}`);

  console.log('5. Querying verified users back from MongoDB...');
  const allEmails = docs.map((d) => d.email);
  const dbUsers = await User.find(
    { email: { $in: allEmails } },
    { email: 1, username: 1, password: 1, isVerifiedEmail: 1, roles: 1 },
  )
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Fetched ${dbUsers.length} verified users from MongoDB.`);

  // Verify authentication on first user
  if (dbUsers.length > 0) {
    const testUser = dbUsers[0];
    const originalPassword = passwordMap.get(testUser.email);
    const isMatch = await bcrypt.compare(originalPassword, testUser.password);
    console.log(`Sample Auth Test (${testUser.email}): Password match = ${isMatch}`);
    if (!isMatch) {
      throw new Error('Authentication self-test failed!');
    }
  }

  console.log('6. Rewriting users.csv with data fetched from MongoDB...');
  const csvLines = ['EMAIL,PASSWORD'];
  for (const user of dbUsers) {
    const plainPassword = passwordMap.get(user.email);
    csvLines.push(`${user.email},${plainPassword}`);
  }

  const csvContent = csvLines.join('\n') + '\n';
  fs.writeFileSync(CSV_PATH, csvContent, 'utf8');
  console.log(`Updated file: ${CSV_PATH} (${dbUsers.length} users)`);

  const totalUsersInDb = await User.countDocuments();
  console.log(`\n🎉 Success! Total users in MongoDB database now: ${totalUsersInDb}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
