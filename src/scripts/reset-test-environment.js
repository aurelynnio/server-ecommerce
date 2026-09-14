require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const amqp = require('amqplib');

async function resetEnvironment() {
  console.log('========================================');
  console.log('🔄 BẮT ĐẦU RESET TOÀN BỘ MÔI TRƯỜNG TEST');
  console.log('========================================\n');

  // 1. Purge RabbitMQ
  console.log('1️⃣  [RabbitMQ] Làm sạch toàn bộ hàng đợi...');
  try {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    const conn = await amqp.connect(rabbitUrl);
    const ch = await conn.createChannel();
    const queues = [
      'order_queue',
      'order_queue_dlq',
      'order_queue_retry',
      'order_queue_failed',
      'notification_queue',
      'notification_queue_dlq',
      'notification_queue_retry',
      'notification_queue_failed',
    ];
    for (const q of queues) {
      try {
        const res = await ch.purgeQueue(q);
        console.log(`   - Queue '${q}': đã xóa ${res.messageCount} messages.`);
      } catch (err) {
        console.log(`   - Queue '${q}': bỏ qua (${err.message})`);
      }
    }
    await ch.close();
    await conn.close();
    console.log('✅ RabbitMQ đã xóa sạch toàn bộ messages tồn đọng.\n');
  } catch (err) {
    console.error('❌ Lỗi purge RabbitMQ:', err.message);
  }

  // 2. Flush Redis
  console.log('2️⃣  [Redis] Xóa toàn bộ cache và tracking keys...');
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });
    const keyCount = await redis.dbsize();
    await redis.flushdb();
    console.log(`✅ Redis đã xóa toàn bộ ${keyCount} keys (order:tracking:*, cart:*, v.v.).\n`);
    await redis.quit();
  } catch (err) {
    console.error('❌ Lỗi flush Redis:', err.message);
  }

  // 3. MongoDB Reset Orders, Payments, Notifications, Carts & Reset Product Stock
  console.log('3️⃣  [MongoDB] Xóa dữ liệu giao dịch test & reset tồn kho sản phẩm...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const ordersRes = await db.collection('orders').deleteMany({});
    console.log(`   - Đã xóa ${ordersRes.deletedCount} đơn hàng (orders) cũ.`);

    const paymentsRes = await db.collection('payments').deleteMany({});
    console.log(`   - Đã xóa ${paymentsRes.deletedCount} thanh toán (payments) cũ.`);

    const cartsRes = await db.collection('carts').deleteMany({});
    console.log(`   - Đã xóa ${cartsRes.deletedCount} giỏ hàng (carts) cũ.`);

    const notifsRes = await db.collection('notifications').deleteMany({});
    console.log(`   - Đã xóa ${notifsRes.deletedCount} thông báo (notifications) cũ.`);

    // Reset stock cho sản phẩm chính dùng test: 6a898b8bc10c01f77709d64d
    const primaryTestProductId = '6a898b8bc10c01f77709d64d';
    const primaryProduct = await db
      .collection('products')
      .findOne({ _id: new mongoose.Types.ObjectId(primaryTestProductId) });
    if (primaryProduct) {
      await db.collection('products').updateOne(
        { _id: primaryProduct._id },
        {
          $set: {
            stock: 1000000,
            soldCount: 0,
            'variants.0.stock': 1000000,
            'variants.0.sold': 0,
          },
        },
      );
      console.log(
        `   - [Sản phẩm 1] ID: ${primaryTestProductId} (${primaryProduct.name}) -> Đã hồi phục tồn kho: 1,000,000.`,
      );
    }

    // Reset stock cho sản phẩm Revlon đang dùng test: 6a898b8bc10c01f77709d6ac
    const revlonProductId = '6a898b8bc10c01f77709d6ac';
    const revlonProduct = await db
      .collection('products')
      .findOne({ _id: new mongoose.Types.ObjectId(revlonProductId) });
    if (revlonProduct) {
      await db.collection('products').updateOne(
        { _id: revlonProduct._id },
        {
          $set: {
            stock: 1000000,
            soldCount: 0,
            'variants.0.stock': 1000000,
            'variants.0.sold': 0,
          },
        },
      );
      console.log(
        `   - [Sản phẩm Revlon] ID: ${revlonProductId} (${revlonProduct.name}) -> Đã hồi phục tồn kho: 1,000,000.`,
      );
    }

    // Tìm thêm 1 sản phẩm phụ khác và cấp 1,000,000 tồn kho để user có lựa chọn thay thế
    const secondaryProduct = await db.collection('products').findOne({
      _id: {
        $nin: [
          new mongoose.Types.ObjectId(primaryTestProductId),
          new mongoose.Types.ObjectId(revlonProductId),
        ],
      },
    });
    if (secondaryProduct) {
      await db.collection('products').updateOne(
        { _id: secondaryProduct._id },
        {
          $set: {
            stock: 1000000,
            soldCount: 0,
            'variants.0.stock': 1000000,
            'variants.0.sold': 0,
          },
        },
      );
      console.log(
        `   - [Sản phẩm 2] ID: ${secondaryProduct._id} (${secondaryProduct.name}) -> Đã hồi phục tồn kho: 1,000,000.`,
      );
    }

    // Lấy thông tin user mẫu
    const sampleUser = await db.collection('users').findOne({ email: 'jmeter.buyer1@example.com' });
    console.log('✅ MongoDB đã hoàn tất dọn dẹp và nạp tồn kho.\n');

    console.log('========================================');
    console.log('📋 THÔNG TIN THAM SỐ ĐỂ TEST JMETER:');
    console.log('========================================');
    if (primaryProduct) {
      console.log(`📦 Sản phẩm chính:`);
      console.log(`   - Product ID : ${primaryProduct._id}`);
      console.log(`   - Variant ID : ${primaryProduct.variants?.[0]?._id || 'null'}`);
      console.log(`   - Name       : ${primaryProduct.name}`);
      console.log(`   - Stock      : 1,000,000`);
      console.log(
        `   - Price      : ${primaryProduct.price?.currentPrice || primaryProduct.price}`,
      );
    }
    if (secondaryProduct) {
      console.log(`📦 Sản phẩm dự phòng (alternative):`);
      console.log(`   - Product ID : ${secondaryProduct._id}`);
      console.log(`   - Variant ID : ${secondaryProduct.variants?.[0]?._id || 'null'}`);
      console.log(`   - Name       : ${secondaryProduct.name}`);
      console.log(`   - Stock      : 1,000,000`);
      console.log(
        `   - Price      : ${secondaryProduct.price?.currentPrice || secondaryProduct.price}`,
      );
    }
    if (sampleUser) {
      console.log(`👤 User test mẫu:`);
      console.log(`   - Email      : ${sampleUser.email}`);
      console.log(`   - Address ID : ${sampleUser.addresses?.[0]?._id || 'N/A'}`);
    }
    console.log('========================================\n');

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Lỗi dọn dẹp MongoDB:', err.message);
  }

  console.log('🎉 Reset hoàn tất 100%! Bạn có thể bắt đầu chạy test lại.');
}

resetEnvironment().catch((err) => {
  console.error('Lỗi ngoài dự kiến:', err);
  process.exit(1);
});
