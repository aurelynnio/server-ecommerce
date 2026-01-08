/**
 * Script để migrate variant structure
 * 
 * Thay đổi:
 * 1. Xóa trường `attributes` trong variants (color, size, material)
 * 2. Chuyển `attributes.color` thành `color` trực tiếp
 * 3. Xóa trường `sku` (sẽ được auto-generate)
 * 4. Thêm trường `sizes` ở product level (nếu chưa có)
 * 
 * Chạy: node scripts/migrate-variant-structure.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

async function migrateVariantStructure() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const productsCollection = db.collection('products');

    // Đếm số products cần migrate
    const totalProducts = await productsCollection.countDocuments({
      $or: [
        { 'variants.attributes': { $exists: true } },
        { 'variants.sku': { $exists: true } }
      ]
    });

    console.log(`\n📊 Found ${totalProducts} products with old variant structure`);

    if (totalProducts === 0) {
      console.log('✅ No products need migration');
      await mongoose.disconnect();
      return;
    }

    // Lấy tất cả products cần migrate
    const products = await productsCollection.find({
      $or: [
        { 'variants.attributes': { $exists: true } },
        { 'variants.sku': { $exists: true } }
      ]
    }).toArray();

    let migratedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const updatedVariants = (product.variants || []).map((variant, index) => {
          // Lấy color từ attributes nếu có
          const color = variant.color || variant.attributes?.color || '';
          
          // Tạo variant mới với cấu trúc đơn giản
          return {
            _id: variant._id,
            name: variant.name || color || `Variant ${index + 1}`,
            color: color,
            price: variant.price || 0,
            stock: variant.stock || 0,
            sold: variant.sold || 0,
            images: variant.images || [],
            // Không giữ lại sku, attributes
          };
        });

        // Collect sizes từ attributes.size nếu có
        const sizesFromVariants = new Set();
        (product.variants || []).forEach(v => {
          if (v.attributes?.size) {
            // Split nếu có nhiều size trong 1 string (VD: "M, L, XL")
            v.attributes.size.split(/[,\s]+/).forEach(s => {
              const trimmed = s.trim();
              if (trimmed) sizesFromVariants.add(trimmed);
            });
          }
        });

        // Merge với sizes hiện có
        const existingSizes = product.sizes || [];
        const allSizes = [...new Set([...existingSizes, ...sizesFromVariants])];

        // Update product
        await productsCollection.updateOne(
          { _id: product._id },
          {
            $set: {
              variants: updatedVariants,
              sizes: allSizes
            }
          }
        );

        migratedCount++;
        console.log(`✅ Migrated: ${product.name} (${product._id})`);
        console.log(`   - Variants: ${updatedVariants.length}`);
        console.log(`   - Sizes: ${allSizes.join(', ') || 'none'}`);
        
      } catch (err) {
        errorCount++;
        console.error(`❌ Error migrating ${product.name}: ${err.message}`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   - Total products: ${totalProducts}`);
    console.log(`   - Migrated: ${migratedCount}`);
    console.log(`   - Errors: ${errorCount}`);

    // Verify migration
    const remainingOld = await productsCollection.countDocuments({
      $or: [
        { 'variants.attributes': { $exists: true } },
      ]
    });

    if (remainingOld === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log(`\n⚠️ ${remainingOld} products still have old structure`);
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateVariantStructure();
