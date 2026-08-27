/**
 * Map/rename legacy categories under the 7 real categories instead of deleting.
 *
 * Context: two category trees coexisted in the DB.
 *   1. Legacy English tree (10 roots, 0 products) — an earlier taxonomy.
 *   2. Real Vietnamese tree (7 roots carrying all products).
 *
 * This script re-parents each legacy root under the matching real root, so the
 * public category tree (roots with parentCategory == null) shows only the 7 real
 * categories, and the legacy subtree becomes nested subcategories of them.
 *
 * Usage:
 *   node src/scripts/map-legacy-categories.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/category.model');

// legacy root slug  ->  real root slug
const LEGACY_TO_REAL = {
  'electronics-and-technology': 'may-tinh-thiet-bi',
  "men's-fashion": 'thoi-trang',
  "women's-fashion": 'thoi-trang',
  shoes: 'thoi-trang',
  accessories: 'thoi-trang',
  'watches-and-jewelry': 'thoi-trang',
  'home-and-living': 'nha-cua-doi-song',
  'beauty-and-health': 'lam-dep',
  'sports-and-outdoors': 'the-thao-du-lich',
  automotive: 'nha-cua-doi-song',
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const all = await Category.find({}).select('_id slug name parentCategory isActive').lean();
  const bySlug = new Map(all.map((c) => [c.slug, c]));

  let updated = 0;
  for (const [legacySlug, realSlug] of Object.entries(LEGACY_TO_REAL)) {
    const legacy = bySlug.get(legacySlug);
    const real = bySlug.get(realSlug);
    if (!legacy) {
      console.warn(`  ! legacy category not found: ${legacySlug}`);
      continue;
    }
    if (!real) {
      console.warn(`  ! real category not found: ${realSlug} (for ${legacySlug})`);
      continue;
    }
    if (legacy._id.toString() === real._id.toString()) continue;

    const prevParent = legacy.parentCategory ? bySlug.get(String(legacy.parentCategory)) : null;
    const result = await Category.updateOne(
      { _id: legacy._id },
      { $set: { parentCategory: real._id } },
    );
    if ((result.modifiedCount || 0) > 0) {
      updated++;
      console.log(
        `  re-parented "${legacy.name}" (${legacy.slug}) -> "${real.name}" (${real.slug})` +
          (prevParent ? ` [was under ${prevParent.slug}]` : ' [was root]'),
      );
    } else {
      console.log(`  no change for "${legacy.slug}"`);
    }
  }

  // After mapping, verify: ensure every real root is still top-level (parent null),
  // and report the new tree shape.
  const after = await Category.find({}).select('_id slug name parentCategory isActive').lean();
  const roots = after.filter((c) => !c.parentCategory);
  console.log(`\nTop-level roots now: ${roots.length}`);
  for (const r of roots) {
    const children = after.filter((c) => c.parentCategory && String(c.parentCategory) === String(r._id));
    console.log(`  - ${r.name} (${r.slug}) [${children.length} direct children]`);
  }

  console.log(`\nUpdated ${updated} legacy categories.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});