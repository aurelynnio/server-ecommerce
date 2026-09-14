/**
 * Script nạp / seed users và cập nhật users.csv
 * Kết nối qua MONGODB_URI trong .env
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.resolve(__dirname, '../../users.csv');

async function exportUsersToCsv() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI in .env');
  }

  await mongoose.connect(uri);

  const User = mongoose.model(
    'User',
    new mongoose.Schema(
      {
        username: String,
        email: { type: String, unique: true },
        password: String,
        roles: { type: String, default: 'user' },
        isVerifiedEmail: { type: Boolean, default: true },
      },
      { collection: 'users', timestamps: true },
    ),
  );

  const users = await User.find({ roles: 'user' })
    .select('email username isVerifiedEmail createdAt')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  console.log(`Tìm thấy ${users.length} users từ MongoDB.`);

  // Đọc password từ file hiện tại nếu có để giữ lại thông tin login
  const passwordMap = new Map();
  if (fs.existsSync(CSV_PATH)) {
    const existingLines = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n').slice(1);
    for (const line of existingLines) {
      const [em, pw] = line.split(',');
      if (em && pw) passwordMap.set(em.trim(), pw.trim());
    }
  }

  const csvLines = ['EMAIL,PASSWORD'];
  for (const u of users) {
    const pw = passwordMap.get(u.email) || 'Password123!';
    csvLines.push(`${u.email},${pw}`);
  }

  const output = csvLines.join('\n') + '\n';
  fs.writeFileSync(CSV_PATH, output, 'utf8');

  console.log(`Đã lưu ${users.length} users vào: ${CSV_PATH}`);

  await mongoose.disconnect();
  process.exit(0);
}

exportUsersToCsv().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
