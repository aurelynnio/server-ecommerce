/**
 * Chuẩn bị dữ liệu kiểm thử tải cao (Load Test Data Preparation)
 *
 * Nhiệm vụ:
 * 1. Tìm hoặc cập nhật sản phẩm Flash Sale đang active có tồn kho dồi dào.
 * 2. Tìm hoặc tạo danh sách tài khoản test (mặc định 50 - 100 users) có địa chỉ giao hàng hợp lệ.
 * 3. Ký mã JWT Access Token chuẩn xác cho từng user.
 * 4. Xuất file `tests/load/test-users.csv` để JMeter đọc (CSV Data Set Config).
 * 5. In ra câu lệnh JMeter CLI sẵn sàng chạy ngay.
 *
 * Cách chạy:
 *   node tests/load/prepare-test-data.js
 *   node tests/load/prepare-test-data.js --users 100
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('../../src/db/connect.db');
const redis = require('../../src/configs/redis.config');
const User = require('../../src/models/user.model');
const Product = require('../../src/models/product.model');
const tokenService = require('../../src/services/token.service');
const bcrypt = require('bcrypt');

const CSV_PATH = path.join(__dirname, 'test-users.csv');

function parseArgInt(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const raw = process.argv[idx + 1];
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function prepareTestData() {
  const requestedUsers = parseArgInt('--users', 50);

  console.log('===========================================================');
  console.log('🚀 KHỞI ĐỘNG CHUẨN BỊ DỮ LIỆU JMETER LOAD TEST FLASH SALE');
  console.log('===========================================================');

  await connectDB();

  // 1. Tìm hoặc chuẩn bị sản phẩm Flash Sale
  console.log('\n📦 1. Đang kiểm tra sản phẩm Flash Sale...');
  const now = new Date();
  let flashSaleProduct = await Product.findOne({
    status: 'published',
    'flashSale.isActive': true,
    'flashSale.endTime': { $gt: now },
  });

  if (!flashSaleProduct) {
    console.log(
      'ℹ️ Không có sản phẩm Flash Sale nào đang active. Đang chọn 1 sản phẩm published để kích hoạt Flash Sale...',
    );
    flashSaleProduct = await Product.findOne({ status: 'published' });
    if (!flashSaleProduct) {
      throw new Error(
        'Không tìm thấy bất kỳ sản phẩm published nào trong Database! Hãy chạy seed trước: npm run seed:dev',
      );
    }

    const endTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Còn hạn 30 ngày
    flashSaleProduct.stock = Math.max(flashSaleProduct.stock || 0, 50000);
    flashSaleProduct.flashSale = {
      isActive: true,
      salePrice: Math.round((flashSaleProduct.price?.currentPrice || 100000) * 0.5),
      discountPercent: 50,
      stock: 50000,
      soldCount: 0,
      startTime: new Date(),
      endTime,
    };
    await flashSaleProduct.save();
    console.log(
      `✅ Đã kích hoạt Flash Sale thành công cho sản phẩm: "${flashSaleProduct.name}" (Stock: 50,000)`,
    );
  } else {
    // Đảm bảo tồn kho đủ lớn để test tải
    if ((flashSaleProduct.flashSale?.stock || 0) < 5000) {
      flashSaleProduct.flashSale.stock = 50000;
      flashSaleProduct.stock = Math.max(flashSaleProduct.stock || 0, 50000);
      await flashSaleProduct.save();
      console.log(`✅ Đã cập nhật lại tồn kho Flash Sale lên 50,000 cái để test tải.`);
    }
    console.log(
      `✅ Sử dụng sản phẩm Flash Sale: "${flashSaleProduct.name}" (ID: ${flashSaleProduct._id})`,
    );
  }

  // 2. Tìm hoặc chuẩn bị danh sách Users có địa chỉ hợp lệ
  console.log(`\n👥 2. Đang chuẩn bị ${requestedUsers} tài khoản User kèm địa chỉ nhận hàng...`);
  let users = await User.find({ 'addresses.0': { $exists: true } }).limit(requestedUsers);

  if (users.length < requestedUsers) {
    const needed = requestedUsers - users.length;
    console.log(`ℹ️ Hiện có ${users.length} user có địa chỉ. Đang tạo thêm ${needed} user test...`);
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const newUsers = [];

    for (let i = 1; i <= needed; i++) {
      const idx = users.length + i;
      newUsers.push({
        username: `loadtest_buyer_${Date.now()}_${idx}`,
        email: `buyer_${Date.now()}_${idx}@loadtest.local`,
        password: hashedPassword,
        roles: 'user',
        isVerifiedEmail: true,
        addresses: [
          {
            fullName: `Nguyễn Khách Hàng ${idx}`,
            phone: '0987654321',
            address: `${idx} Đường Flash Sale, Phường Bến Nghé`,
            city: 'Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường Bến Nghé',
            isDefault: true,
          },
        ],
      });
    }

    const inserted = await User.insertMany(newUsers);
    users = users.concat(inserted);
    console.log(`✅ Đã tạo thêm ${inserted.length} user test thành công.`);
  }

  // 3. Ký mã JWT Access Token và tạo mảng CSV
  console.log('\n🔑 3. Đang ký JWT Access Token cho từng User...');
  const csvRows = ['USER_ID,TOKEN,ADDRESS_ID,PRODUCT_ID'];
  let sampleToken = '';
  let sampleAddressId = '';

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const addressId = u.addresses[0]._id.toString();
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        userId: u._id.toString(),
        username: u.username,
        email: u.email,
        role: u.roles || 'user',
        permissions: u.permissions || [],
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '7d' },
    );

    if (i === 0) {
      sampleToken = token;
      sampleAddressId = addressId;
    }

    csvRows.push(`${u._id.toString()},${token},${addressId},${flashSaleProduct._id.toString()}`);
  }

  // 4. Ghi file CSV
  fs.writeFileSync(CSV_PATH, csvRows.join('\n'), 'utf8');
  console.log(`✅ Đã xuất file CSV: ${CSV_PATH} (${users.length} dòng)`);

  // 5. Ngắt kết nối dọn dẹp
  if (redis.status === 'ready' || redis.status === 'connecting') {
    await redis.quit();
  }
  await mongoose.connection.close();

  // 6. In hướng dẫn chạy JMeter
  console.log('\n===========================================================');
  console.log('🎉 CHUẨN BỊ DỮ LIỆU HOÀN TẤT! SẴN SÀNG CHẠY TEST JMETER');
  console.log('===========================================================');
  console.log(`• Product ID     : ${flashSaleProduct._id}`);
  console.log(`• Sample Address : ${sampleAddressId}`);
  console.log(`• Sample User ID : ${users[0]._id}`);
  console.log(`• Total VUsers   : ${users.length}`);
  console.log(`• CSV Data Path  : ${CSV_PATH}`);
  console.log('\n📌 LỆNH CHẠY JMETER CLI (NON-GUI) NHANH:');
  console.log(
    `& "C:\\Users\\cyhin\\Downloads\\apache-jmeter-5.6.3\\apache-jmeter-5.6.3\\bin\\jmeter.bat" ` +
      `-n -t tests\\load\\rabbitmq-order-concurrency.jmx ` +
      `-Jthreads=50 -Jduration=30 -Jsync_users=25 ` +
      `-JproductId=${flashSaleProduct._id} -JaddressId=${sampleAddressId} -Jtoken=${sampleToken} ` +
      `-l tests\\load\\results.jtl -e -o tests\\load\\report`,
  );
  console.log('===========================================================\n');
}

prepareTestData().catch((err) => {
  console.error('❌ Lỗi khi chuẩn bị dữ liệu test:', err);
  process.exit(1);
});
