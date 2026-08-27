/**
 * Build a consolidated real-product dataset from downloaded open e-commerce CSVs.
 *
 * Sources (open, from the luminati-io eCommerce-dataset-samples repo):
 *   - Amazon, Lazada, Shopee, Shein, Walmart  (1001+ rows each)
 *
 * Output: src/scripts/data/real-products.json  (~1000 normalized products)
 *
 * Usage:
 *   node src/scripts/build-real-dataset.js
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw');
const OUT_DIR = path.join(__dirname, 'data');
const OUT_FILE = path.join(OUT_DIR, 'real-products.json');

const TARGET_COUNT = 1000;
const USD_TO_VND = 26000; // approx conversion for display in VND store

const FILES = {
  amazon: 'amazon-products.csv',
  lazada: 'lazada-products.csv',
  shopee: 'shopee-products.csv',
  shein: 'shein-products.csv',
  walmart: 'walmart-products.csv',
};

function num(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^0-9.-]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Clean a single image URL: strip JSON quotes, whitespace, trailing trash,
// and only keep absolute http(s) URLs. Returns '' when invalid.
function cleanUrl(v) {
  if (typeof v !== 'string') return '';
  let s = v.trim();
  // The Walmart/Shein CSVs store values as JSON-quoted strings like
  // "\"https://...jpeg\"" so we trim surrounding double quotes and braces.
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('{')) {
    // e.g. {"url":"..."} - try to extract url
    try {
      const obj = JSON.parse(s.replace(/'/g, '"'));
      if (obj && obj.url) s = String(obj.url).trim();
    } catch {
      return '';
    }
  }
  return /^https?:\/\/.+/i.test(s) ? s : '';
}

function parseImages(v) {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr.map(cleanUrl).filter(Boolean);
    const single = cleanUrl(arr);
    return single ? [single] : [];
  } catch {
    const single = cleanUrl(v);
    return single ? [single] : [];
  }
}

// Parse a string that is either a JSON array ("[\"A\",\"B\"]") or a
// comma-separated list ("Red, Green, Blue") into a clean string[].
function parseList(v) {
  if (!v) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  if (raw === '[]') return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    // not valid JSON -> fall through to comma split
  }
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((x) => String(x).replace(/^["']|["']$/g, '').trim())
    .filter(Boolean);
}

// Simple "brand-ish" first token of a product title to use as fallback brand.
function fallbackBrand(title) {
  if (!title) return '';
  return title.trim().split(/\s+/)[0] || '';
}

// Map a product to one of the app's 7 global categories via keyword matching.
const CATEGORY_KEYWORDS = [
  {
    slug: 'dien-thoai-phu-kien',
    name: 'Điện thoại & Phụ kiện',
    keywords: ['phone', 'smartphone', 'iphone', 'samsung galaxy', 'case', 'charger', 'mobile', 'cell', 'sim', 'screen protector', 'power bank'],
  },
  {
    slug: 'thoi-trang',
    name: 'Thời trang',
    keywords: ['dress', 'shirt', 'shoes', 'sneaker', 'jean', 'jacket', 'hoodie', 'skirt', 't-shirt', 'tshirt', 'top', 'blouse', 'sandal', 'boot', 'fashion', 'apparel', 'trouser', 'pant', 'sock', 'hat', 'cap', 'bag', 'wallet', 'purse', 'watch'],
  },
  {
    slug: 'lam-dep',
    name: 'Làm đẹp',
    keywords: ['makeup', 'lipstick', 'foundation', 'serum', 'cream', 'skincare', 'skin care', 'shampoo', 'conditioner', 'perfume', 'fragrance', 'eyeliner', 'mascara', 'beauty', 'cosmetic', 'face', 'mask skin', 'lotion'],
  },
  {
    slug: 'nha-cua-doi-song',
    name: 'Nhà cửa & Đời sống',
    keywords: ['furniture', 'chair', 'table', 'sofa', 'lamp', 'bed', 'shelf', 'kitchen', 'cookware', 'pot', 'pan', 'towel', 'tumbler', 'water bottle', 'storage', 'bathroom', 'cabinet', 'decor', 'pillow', 'cushion', 'curtain'],
  },
  {
    slug: 'may-tinh-thiet-bi',
    name: 'Máy tính & Thiết bị',
    keywords: ['laptop', 'notebook', 'keyboard', 'mouse', 'headphone', 'earbud', 'speaker', 'monitor', 'tablet', 'camera', 'webcam', 'computer', 'printer', 'router', 'ssd', 'hard drive', 'memory', 'gpu', 'desktop'],
  },
  {
    slug: 'the-thao-du-lich',
    name: 'Thể thao & Du lịch',
    keywords: ['running', 'sport', 'fitness', 'gym', 'yoga', 'bicycle', 'bike', 'soccer', 'football', 'basketball', 'tennis', 'dumbbell', 'tent', 'camping', 'hiking', 'backpack', 'travel', 'luggage', 'suitcase', 'jersey'],
  },
  {
    slug: 'thuc-pham-do-uong',
    name: 'Thực phẩm & Đồ uống',
    keywords: ['coffee', 'tea', 'snack', 'candy', 'chocolate', 'cookie', 'rice', 'pasta', 'sauce', 'oil', 'spice', 'cereal', 'drink', 'juice', 'protein', 'supplement', 'food', 'granola', 'nut', 'dried'],
  },
];

function classifyCategory(item) {
  const text = [
    item.title || item.name,
    item.category,
    item.categoryName,
    item.department,
    item.breadcrumb,
    item.rootCategory,
    item.brand,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const cat of CATEGORY_KEYWORDS) {
    if (cat.keywords.some((k) => text.includes(k))) {
      return cat;
    }
  }
  return null;
}

function convertPrice(v, currency) {
  const n = num(v);
  if (!n) return null;
  const cur = (currency || 'USD').toUpperCase();
  // Convert non-VND to VND for display consistency.
  const vnd = cur === 'VND' ? n : Math.round(n * USD_TO_VND);
  // Round to nearest 1000 for a clean store price.
  return Math.max(1000, Math.round(vnd / 1000) * 1000);
}

function clampConfidence(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.min(5, Math.max(0, Math.round(n * 10) / 10));
}

function normalizeAmazon(r) {
  const title = (r.title || '').trim();
  if (!title) return null;
  const images = parseImages(r.images);
  const main = parseImages(r.image_url)[0] || images[0] || '';
  const price = r.final_price || r.initial_price;
  const availability = String(r.availability || '').toLowerCase();
  return {
    name: title.slice(0, 190),
    description: (r.description || '').slice(0, 5000),
    brand: (r.brand || fallbackBrand(title)).slice(0, 90),
    category: r.department || r.categories || '',
    price,
    currency: r.currency,
    stock: availability.includes('in') || availability.includes('true') || availability === '1' ? 1 : 0,
    rating: clampConfidence(num(r.rating)),
    reviewCount: num(r.reviews_count),
    images: main ? [main, ...images.filter((x) => x !== main)].slice(0, 8) : images.slice(0, 8),
    sizes: [],
    colors: [],
    origin: 'amazon',
  };
}

function normalizeLazada(r) {
  const title = (r.title || '').trim();
  if (!title) return null;
  const main = cleanUrl(r.image);
  return {
    name: title.slice(0, 190),
    description: (r.product_description || '').slice(0, 5000),
    brand: (r.brand || fallbackBrand(title)).slice(0, 90),
    category: r.breadcrumb || '',
    price: r.final_price || r.initial_price,
    currency: r.currency,
    stock: 1,
    rating: clampConfidence(num(r.rating)),
    reviewCount: num(r.reviews),
    images: main ? [main] : [],
    sizes: [],
    colors: parseList(r.colors),
    origin: 'lazada',
  };
}

function normalizeShopee(r) {
  const title = (r.title || '').trim();
  if (!title) return null;
  const main = cleanUrl(r.image);
  return {
    name: title.slice(0, 190),
    description: (r['Product Description'] || r.product_description || '').slice(0, 5000),
    brand: (r.brand || fallbackBrand(title)).slice(0, 90),
    category: r.breadcrumb || '',
    price: r.final_price || r.initial_price,
    currency: r.currency,
    stock: num(r.stock) ? 1 : 0,
    sold: num(r.sold) || 0,
    rating: clampConfidence(num(r.rating)),
    reviewCount: num(r.reviews),
    images: main ? [main] : [],
    sizes: [],
    colors: [],
    origin: 'shopee',
  };
}

function normalizeShein(r) {
  const title = (r.product_name || '').trim();
  if (!title) return null;
  const main = cleanUrl(r.main_image);
  const extra = parseImages(r.image_urls);
  const images = main ? [main, ...extra.filter((x) => x !== main)].slice(0, 8) : extra.slice(0, 8);
  return {
    name: title.slice(0, 190),
    description: (r.description || '').slice(0, 5000),
    brand: (r.brand || fallbackBrand(title)).slice(0, 90),
    category: r.root_category || r.category_tree || '',
    price: r.final_price || r.initial_price,
    currency: r.currency,
    stock: r.in_stock === true || r.in_stock === 'true' || String(r.in_stock).toLowerCase().includes('true') ? 1 : 0,
    rating: clampConfidence(num(r.rating)),
    reviewCount: num(r.reviews_count),
    images,
    sizes: parseList(r.size),
    colors: parseList(r.color),
    origin: 'shein',
  };
}

function normalizeWalmart(r) {
  const title = (r.product_name || r.title || '').trim();
  if (!title) return null;
  const main = cleanUrl(r.main_image);
  const extra = parseImages(r.image_urls);
  const images = main ? [main, ...extra.filter((x) => x !== main)].slice(0, 8) : extra.slice(0, 8);
  return {
    name: title.slice(0, 190),
    description: (r.description || '').slice(0, 5000),
    brand: (r.brand || fallbackBrand(title)).slice(0, 90),
    category: r.category_name || r.category_path || '',
    price: r.final_price || r.initial_price,
    currency: r.currency,
    stock: 1,
    rating: clampConfidence(num(r.rating) || num(r.rating_stars)),
    reviewCount: num(r.review_count),
    images,
    sizes: parseList(r.sizes),
    colors: parseList(r.colors),
    origin: 'walmart',
  };
}

function load(file) {
  const p = path.join(RAW_DIR, file);
  if (!fs.existsSync(p)) {
    console.warn(`  ! missing file: ${file}`);
    return [];
  }
  const content = fs.readFileSync(p, 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });
}

function main() {
  console.log('Building real product dataset from raw CSVs...');

  const normalizers = {
    amazon: normalizeAmazon,
    lazada: normalizeLazada,
    shopee: normalizeShopee,
    shein: normalizeShein,
    walmart: normalizeWalmart,
  };

  const byCategory = {};
  let inspected = 0;
  let valid = 0;
  const seen = new Set();

  for (const [src, file] of Object.entries(FILES)) {
    const rows = load(file);
    inspected += rows.length;
    console.log(`  ${src}: ${rows.length} rows`);
    for (const row of rows) {
      const item = normalizers[src](row);
      if (!item) continue;
      if (!item.price || !num(item.price) || !item.images.length) continue; // need valid price + image to be usable

      const cat = classifyCategory(item);
      if (!cat) continue; // only keep items that map to the store's categories

      const dedupeKey = `${cat.slug}|${item.name.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      if (!byCategory[cat.slug]) byCategory[cat.slug] = [];
      byCategory[cat.slug].push({ ...item, categorySlug: cat.slug });
      valid++;
    }
  }

  console.log(`  inspected=${inspected}, mapped&valid=${valid}`);

  // Balance allocation so each category gets a share of the ~1000 target.
  const cats = Object.keys(byCategory);
  const perCat = Math.floor(TARGET_COUNT / cats.length);
  const output = [];
  for (const slug of cats) {
    const pool = byCategory[slug];
    const take = Math.min(pool.length, perCat);
    output.push(...pool.slice(0, take));
  }
  // Top up remaining from the largest leftover pools until we hit target.
  let idx = 0;
  while (output.length < TARGET_COUNT) {
    const slug = cats[idx % cats.length];
    const all = byCategory[slug];
    if (!all) break;
    const used = output.filter((x) => x.categorySlug === slug).length;
    if (used < all.length) {
      output.push(all[used]);
    }
    idx++;
    if (idx > cats.length * 20) break; // safety
  }

  // Attach converted VND price and sold fallback.
  const final = output.map((item, _i) => {
    const currentPrice = convertPrice(item.price, item.currency);
    return {
      name: item.name,
      description: item.description,
      brand: item.brand,
      categorySlug: item.categorySlug,
      price: {
        currentPrice,
        discountPrice: null,
        currency: 'VND',
      },
      stock: item.stock || 0,
      soldCount: item.sold || 0,
      ratingAverage: item.rating,
      reviewCount: item.reviewCount || 0,
      sizes: item.sizes || [],
      images: item.images || [],
      colors: item.colors || [],
      origin: item.origin,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(final, null, 2), 'utf8');

  const counts = {};
  for (const p of final) {
    counts[p.categorySlug] = (counts[p.categorySlug] || 0) + 1;
  }
  console.log(`\nWrote ${final.length} products to ${OUT_FILE}`);
  console.log('By category:', JSON.stringify(counts, null, 2));

  const noImage = final.filter((p) => !p.images.length).length;
  const noPrice = final.filter((p) => !p.price.currentPrice).length;
  console.log(`Missing image: ${noImage}, missing price: ${noPrice}`);
}

main();