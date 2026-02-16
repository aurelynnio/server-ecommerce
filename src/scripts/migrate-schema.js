/**
 * One-time migration script for schema changes.
 *
 * Migrates data from old embedded arrays to new standalone collections
 * and renames/removes deprecated fields.
 *
 * Changes handled:
 *  1. user.wishlist[]         -> wishlists collection
 *  2. user.followingShops[]   -> shop_followers collection (user side)
 *  3. shop.followers[]        -> shop_followers collection (shop side)
 *  4. voucher.usedBy[]        -> voucher_usages collection
 *  5. order.products.modelId  -> order.products.variantId (rename)
 *  6. order.products.tierIndex -> removed (unset)
 *  7. payment.vnpayData       -> payment.gatewayData (rename)
 *  8. Drop stale index addresses.phone_1 on users collection
 *
 * Usage:
 *   node src/scripts/migrate-schema.js
 *   node src/scripts/migrate-schema.js --dry-run   # Preview without writing
 *
 * Safe to run multiple times (idempotent).
 */

require("dotenv").config();

const mongoose = require("mongoose");

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const DRY_RUN = hasFlag("--dry-run");

function log(msg) {
  const prefix = DRY_RUN ? "[DRY-RUN] " : "";
  console.log(`${prefix}${msg}`);
}

async function migrateWishlists(db) {
  log("--- Migrating user.wishlist[] -> wishlists collection ---");

  const users = await db
    .collection("users")
    .find({ wishlist: { $exists: true, $ne: [] } })
    .project({ _id: 1, wishlist: 1 })
    .toArray();

  let totalDocs = 0;

  for (const user of users) {
    if (!Array.isArray(user.wishlist) || user.wishlist.length === 0) continue;

    const docs = user.wishlist.map((productId) => ({
      userId: user._id,
      productId: new mongoose.Types.ObjectId(productId),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    totalDocs += docs.length;

    if (!DRY_RUN) {
      // ordered:false so duplicates are skipped via the unique index
      await db
        .collection("wishlists")
        .insertMany(docs, { ordered: false })
        .catch((e) => {
          // Filter out duplicate-key errors (code 11000); re-throw others
          if (e.code !== 11000 && !e.writeErrors?.every((w) => w.code === 11000)) {
            throw e;
          }
        });
    }
  }

  log(`  Found ${users.length} users with wishlist data -> ${totalDocs} wishlist docs`);

  // Remove the old field from all users
  if (!DRY_RUN) {
    const result = await db
      .collection("users")
      .updateMany({ wishlist: { $exists: true } }, { $unset: { wishlist: "" } });
    log(`  Unset wishlist field from ${result.modifiedCount} user documents`);
  }
}

async function migrateFollowers(db) {
  log("--- Migrating user.followingShops[] + shop.followers[] -> shop_followers collection ---");

  // --- From user.followingShops[] ---
  const usersWithFollowing = await db
    .collection("users")
    .find({ followingShops: { $exists: true, $ne: [] } })
    .project({ _id: 1, followingShops: 1 })
    .toArray();

  let totalFromUsers = 0;
  for (const user of usersWithFollowing) {
    if (!Array.isArray(user.followingShops) || user.followingShops.length === 0) continue;

    const docs = user.followingShops.map((shopId) => ({
      shopId: new mongoose.Types.ObjectId(shopId),
      userId: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    totalFromUsers += docs.length;

    if (!DRY_RUN) {
      await db
        .collection("shop_followers")
        .insertMany(docs, { ordered: false })
        .catch((e) => {
          if (e.code !== 11000 && !e.writeErrors?.every((w) => w.code === 11000)) {
            throw e;
          }
        });
    }
  }
  log(`  From user.followingShops[]: ${usersWithFollowing.length} users -> ${totalFromUsers} docs`);

  // --- From shop.followers[] ---
  const shopsWithFollowers = await db
    .collection("shops")
    .find({ followers: { $exists: true, $ne: [] } })
    .project({ _id: 1, followers: 1 })
    .toArray();

  let totalFromShops = 0;
  for (const shop of shopsWithFollowers) {
    if (!Array.isArray(shop.followers) || shop.followers.length === 0) continue;

    const docs = shop.followers.map((userId) => ({
      shopId: shop._id,
      userId: new mongoose.Types.ObjectId(userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    totalFromShops += docs.length;

    if (!DRY_RUN) {
      await db
        .collection("shop_followers")
        .insertMany(docs, { ordered: false })
        .catch((e) => {
          if (e.code !== 11000 && !e.writeErrors?.every((w) => w.code === 11000)) {
            throw e;
          }
        });
    }
  }
  log(`  From shop.followers[]: ${shopsWithFollowers.length} shops -> ${totalFromShops} docs`);

  // Recompute followerCount on each shop from the new collection
  if (!DRY_RUN) {
    const counts = await db
      .collection("shop_followers")
      .aggregate([{ $group: { _id: "$shopId", count: { $sum: 1 } } }])
      .toArray();

    for (const c of counts) {
      await db
        .collection("shops")
        .updateOne({ _id: c._id }, { $set: { followerCount: c.count } });
    }
    log(`  Updated followerCount on ${counts.length} shops`);
  }

  // Remove old fields
  if (!DRY_RUN) {
    const userResult = await db
      .collection("users")
      .updateMany({ followingShops: { $exists: true } }, { $unset: { followingShops: "" } });
    log(`  Unset followingShops from ${userResult.modifiedCount} user documents`);

    const shopResult = await db
      .collection("shops")
      .updateMany({ followers: { $exists: true } }, { $unset: { followers: "" } });
    log(`  Unset followers from ${shopResult.modifiedCount} shop documents`);
  }
}

async function migrateVoucherUsage(db) {
  log("--- Migrating voucher.usedBy[] -> voucher_usages collection ---");

  const vouchers = await db
    .collection("vouchers")
    .find({ usedBy: { $exists: true, $ne: [] } })
    .project({ _id: 1, usedBy: 1 })
    .toArray();

  let totalDocs = 0;

  for (const voucher of vouchers) {
    if (!Array.isArray(voucher.usedBy) || voucher.usedBy.length === 0) continue;

    const docs = voucher.usedBy.map((entry) => {
      // usedBy entries may be plain ObjectIds or { userId, usedAt } objects
      const userId =
        entry instanceof mongoose.Types.ObjectId || typeof entry === "string"
          ? new mongoose.Types.ObjectId(entry)
          : new mongoose.Types.ObjectId(entry.userId);
      const createdAt =
        entry?.usedAt instanceof Date ? entry.usedAt : new Date();

      return {
        voucherId: voucher._id,
        userId,
        createdAt,
        updatedAt: createdAt,
      };
    });

    totalDocs += docs.length;

    if (!DRY_RUN) {
      await db
        .collection("voucher_usages")
        .insertMany(docs, { ordered: false })
        .catch((e) => {
          if (e.code !== 11000 && !e.writeErrors?.every((w) => w.code === 11000)) {
            throw e;
          }
        });
    }
  }

  log(`  Found ${vouchers.length} vouchers with usedBy data -> ${totalDocs} usage docs`);

  // Remove old field
  if (!DRY_RUN) {
    const result = await db
      .collection("vouchers")
      .updateMany({ usedBy: { $exists: true } }, { $unset: { usedBy: "" } });
    log(`  Unset usedBy from ${result.modifiedCount} voucher documents`);
  }
}

async function migrateOrderProducts(db) {
  log("--- Migrating order.products: modelId -> variantId, remove tierIndex ---");

  // Rename modelId -> variantId on all order product sub-documents
  const renameResult = await db.collection("orders").aggregate([
    { $match: { "products.modelId": { $exists: true } } },
    { $count: "count" },
  ]).toArray();

  const affectedOrders = renameResult[0]?.count || 0;
  log(`  Orders with products.modelId: ${affectedOrders}`);

  if (!DRY_RUN && affectedOrders > 0) {
    // MongoDB rename on array sub-documents requires iterating.
    // Use bulkWrite for efficiency.
    const cursor = db
      .collection("orders")
      .find({ "products.modelId": { $exists: true } })
      .project({ _id: 1, products: 1 });

    let updated = 0;
    const ops = [];

    for await (const order of cursor) {
      const newProducts = order.products.map((p) => {
        const { modelId, tierIndex, ...rest } = p;
        return { ...rest, variantId: modelId ?? null };
      });

      ops.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { products: newProducts } },
        },
      });

      if (ops.length >= 500) {
        await db.collection("orders").bulkWrite(ops);
        updated += ops.length;
        ops.length = 0;
      }
    }

    if (ops.length > 0) {
      await db.collection("orders").bulkWrite(ops);
      updated += ops.length;
    }

    log(`  Migrated products on ${updated} orders`);
  }

  // Also remove tierIndex from any orders that had it but no modelId
  if (!DRY_RUN) {
    // Use $[] positional-all operator to unset tierIndex in remaining docs
    const tierResult = await db
      .collection("orders")
      .updateMany(
        { "products.tierIndex": { $exists: true } },
        { $unset: { "products.$[].tierIndex": "" } }
      );
    if (tierResult.modifiedCount > 0) {
      log(`  Removed tierIndex from ${tierResult.modifiedCount} additional orders`);
    }
  }
}

async function migratePayments(db) {
  log("--- Migrating payment.vnpayData -> payment.gatewayData ---");

  const count = await db
    .collection("payments")
    .countDocuments({ vnpayData: { $exists: true } });

  log(`  Payments with vnpayData: ${count}`);

  if (!DRY_RUN && count > 0) {
    // Use $rename for top-level field
    const result = await db
      .collection("payments")
      .updateMany(
        { vnpayData: { $exists: true } },
        { $rename: { vnpayData: "gatewayData" } }
      );
    log(`  Renamed vnpayData -> gatewayData on ${result.modifiedCount} payments`);
  }
}

async function dropStaleIndexes(db) {
  log("--- Dropping stale indexes ---");

  // 1. addresses.phone_1 unique index on users (was removed because phone isn't unique across addresses)
  try {
    const userIndexes = await db.collection("users").indexes();
    const phoneIndex = userIndexes.find(
      (idx) => idx.name === "addresses.phone_1" || idx.key?.["addresses.phone"] === 1
    );
    if (phoneIndex) {
      if (!DRY_RUN) {
        await db.collection("users").dropIndex(phoneIndex.name);
      }
      log(`  Dropped index ${phoneIndex.name} from users`);
    } else {
      log("  No addresses.phone index found on users (already clean)");
    }
  } catch (e) {
    log(`  Warning dropping user index: ${e.message}`);
  }

  // 2. Old timestamp index on permission_audits (renamed to createdAt)
  try {
    const auditIndexes = await db.collection("permission_audits").indexes();
    const tsIndex = auditIndexes.find(
      (idx) => idx.key?.timestamp !== undefined
    );
    if (tsIndex) {
      if (!DRY_RUN) {
        await db.collection("permission_audits").dropIndex(tsIndex.name);
      }
      log(`  Dropped index ${tsIndex.name} from permission_audits`);
    } else {
      log("  No timestamp index found on permission_audits (already clean)");
    }
  } catch (e) {
    // Collection may not exist if app was never used with permissions; safe to ignore
    log(`  Warning dropping audit index: ${e.message}`);
  }
}

async function fixShopRatingDefaults(db) {
  log("--- Fixing shop rating defaults (4.5 -> 0 for shops with no reviews) ---");

  // Only touch shops that have the old default 4.5 and 0 followers (likely never reviewed)
  const result = await db
    .collection("shops")
    .updateMany(
      { rating: 4.5, $or: [{ reviewCount: 0 }, { reviewCount: { $exists: false } }] },
      { $set: { rating: 0 } }
    );

  log(`  Updated rating to 0 on ${result.modifiedCount} shops`);
}

async function createIndexes(db) {
  log("--- Ensuring indexes on new collections ---");

  // shop_followers
  await db.collection("shop_followers").createIndex({ shopId: 1, userId: 1 }, { unique: true }).catch(() => {});
  await db.collection("shop_followers").createIndex({ userId: 1, createdAt: -1 }).catch(() => {});
  await db.collection("shop_followers").createIndex({ shopId: 1, createdAt: -1 }).catch(() => {});

  // wishlists
  await db.collection("wishlists").createIndex({ userId: 1, productId: 1 }, { unique: true }).catch(() => {});
  await db.collection("wishlists").createIndex({ userId: 1, createdAt: -1 }).catch(() => {});
  await db.collection("wishlists").createIndex({ productId: 1 }).catch(() => {});

  // voucher_usages
  await db.collection("voucher_usages").createIndex({ voucherId: 1, userId: 1 }).catch(() => {});
  await db.collection("voucher_usages").createIndex({ voucherId: 1, createdAt: -1 }).catch(() => {});
  await db.collection("voucher_usages").createIndex({ userId: 1, createdAt: -1 }).catch(() => {});

  log("  Indexes ensured on shop_followers, wishlists, voucher_usages");
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI");
  }

  log(`Starting migration (DRY_RUN=${DRY_RUN})`);

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  try {
    await createIndexes(db);
    await migrateWishlists(db);
    await migrateFollowers(db);
    await migrateVoucherUsage(db);
    await migrateOrderProducts(db);
    await migratePayments(db);
    await dropStaleIndexes(db);
    await fixShopRatingDefaults(db);

    log("Migration complete.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("migrate-schema error:", err?.message || err);
  process.exit(1);
});
