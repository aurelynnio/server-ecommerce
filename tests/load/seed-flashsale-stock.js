const mongoose = require('mongoose');
const amqp = require('amqplib');
const redisClient = require('../../src/configs/redis.config');
require('dotenv').config();

async function main() {
  console.log('=== SEEDING FLASH SALE STOCK (FAIL-FAST SHIELD) ===');

  // 1. Connect MongoDB and reset stock to 50
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const productId = new mongoose.Types.ObjectId('6a898b89c10c01f77709d2de');

  await db.collection('products').updateOne(
    { _id: productId },
    {
      $set: {
        stock: 50,
        soldCount: 0,
        'variants.0.stock': 50,
        'variants.0.sold': 0,
      },
    },
  );

  const product = await db.collection('products').findOne({ _id: productId });
  const baseOrderCount = await db.collection('orders').countDocuments();
  console.log(`[MongoDB] Product [${productId}] stock reset to: ${product.stock}`);
  console.log(`[MongoDB] Baseline order count: ${baseOrderCount}`);

  // 2. Initialize Redis Flash Sale Stock Shield to 50
  const stockKey = `stock:flashsale:${productId.toString()}`;
  await redisClient.set(stockKey, '50', 'EX', 86400);
  const redisVal = await redisClient.get(stockKey);
  console.log(`[Redis Shield] Initialized key [${stockKey}] = ${redisVal}`);

  // 3. Purge RabbitMQ queues
  const conn = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost:5672');
  const ch = await conn.createChannel();
  for (const q of ['order_queue', 'order_queue_dlq', 'order_queue_retry', 'order_queue_failed']) {
    try {
      const purged = await ch.purgeQueue(q);
      console.log(`[RabbitMQ] Purged queue [${q}]: ${purged.messageCount} old messages removed`);
    } catch (qErr) {
      // queue might not exist yet
    }
  }
  await conn.close();

  console.log('=== READY FOR FAIL-FAST FLASH SALE LOAD TEST ===');
  await redisClient.quit();
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
