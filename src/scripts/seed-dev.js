/**
 * Seed dev data with realistic relationships across models.
 *
 * Safe defaults:
 * - Idempotent: if there are already products, it will skip unless --force / --reset
 * - Reset is blocked in production
 *
 * Usage:
 *   node src/scripts/seed-dev.js
 *   node src/scripts/seed-dev.js --quick
 *   node src/scripts/seed-dev.js --force
 *   node src/scripts/seed-dev.js --reset
 */

require("dotenv").config();

const mongoose = require("mongoose");
const slugify = require("slugify");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { faker } = require("@faker-js/faker");

// Caches
const cacheService = require("../services/cache.service");
const redis = require("../configs/redis.config");

// Models
const Banner = require("../models/banner.model");
const Cart = require("../models/cart.model");
const Category = require("../models/category.model");
const Notification = require("../models/notification.model");
const Order = require("../models/order.model");
const Payment = require("../models/payment.model");
const Product = require("../models/product.model");
const Review = require("../models/review.model");
const Settings = require("../models/settings.model");
const Shop = require("../models/shop.model");
const ShopCategory = require("../models/shop.category.model");
const User = require("../models/user.model");
const { Conversation, Message } = require("../models/conversation.model");
const ShopFollower = require("../models/shop-follower.model");
const Wishlist = require("../models/wishlist.model");
const VoucherUsage = require("../models/voucher-usage.model");

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseArgInt(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const raw = process.argv[idx + 1];
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const defaultGlobalCategories = [
  { name: "Điện thoại & Phụ kiện", slug: "dien-thoai-phu-kien" },
  { name: "Thời trang", slug: "thoi-trang" },
  { name: "Làm đẹp", slug: "lam-dep" },
  { name: "Nhà cửa & Đời sống", slug: "nha-cua-doi-song" },
  { name: "Máy tính & Thiết bị", slug: "may-tinh-thiet-bi" },
  { name: "Thể thao & Du lịch", slug: "the-thao-du-lich" },
  { name: "Thực phẩm & Đồ uống", slug: "thuc-pham-do-uong" },
];

const unsplash = [
  // A small curated list of stable Unsplash image URLs
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1585386959984-a41552231693?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMany(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

async function ensureCategories() {
  const existing = await Category.find({ isActive: true }).select("_id slug");
  if (existing.length > 0) return existing;

  try {
    await Category.insertMany(
      defaultGlobalCategories.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: "",
        images: [],
        isActive: true,
      })),
      { ordered: false },
    );
  } catch (_e) {
    // ignore duplicates
  }
  return await Category.find({ isActive: true }).select("_id slug");
}

async function ensureSettings() {
  const existing = await Settings.findOne({ key: "main" });
  if (existing) return existing;
  return await Settings.create({
    key: "main",
    store: {
      name: "Nantian Seed Store",
      email: "support@seed.local",
      phone: "0900000000",
      address: "HCMC, Vietnam",
      description: "Seed data store configuration",
      logo: "",
      favicon: "",
    },
  });
}

async function ensureBanners() {
  const count = await Banner.countDocuments({});
  if (count > 0) return;
  await Banner.insertMany(
    [
      {
        title: "Flash Sale",
        subtitle: "Giảm sâu trong hôm nay",
        imageUrl: pick(unsplash),
        link: "/flash-sale",
        theme: "light",
        order: 1,
        isActive: true,
      },
      {
        title: "Hàng mới về",
        subtitle: "Cập nhật mỗi ngày",
        imageUrl: pick(unsplash),
        link: "/products",
        theme: "light",
        order: 2,
        isActive: true,
      },
      {
        title: "Freeship",
        subtitle: "Đơn từ 0đ",
        imageUrl: pick(unsplash),
        link: "/products",
        theme: "light",
        order: 3,
        isActive: true,
      },
    ],
    { ordered: false },
  );
}

async function hardReset() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset in production");
  }
  // Extra guard: avoid nuking Atlas / remote DB by accident.
  // To override, set SEED_RESET_OK=YES explicitly.
  if (
    process.env.SEED_RESET_OK !== "YES" &&
    typeof process.env.MONGODB_URI === "string" &&
    process.env.MONGODB_URI.includes("mongodb+srv://")
  ) {
    throw new Error(
      "Refusing to reset on mongodb+srv (Atlas). Set SEED_RESET_OK=YES if you really want to wipe remote data.",
    );
  }

  // Wipe collections that drive the storefront.
  await Promise.all([
    Banner.deleteMany({}),
    Cart.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Product.deleteMany({}),
    Review.deleteMany({}),
    ShopCategory.deleteMany({}),
    Shop.deleteMany({}),
    User.deleteMany({}),
    Settings.deleteMany({}),
    ShopFollower.deleteMany({}),
    Wishlist.deleteMany({}),
    VoucherUsage.deleteMany({}),
    // Categories are kept (they are reference data) to avoid breaking slug routes.
  ]);
}

async function ensureUsers({ sellers, buyers }) {
  const passwordHash = await bcrypt.hash("123456", 10);

  // Admin
  const adminEmail = "admin@seed.local";
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      username: "admin_seed",
      email: adminEmail,
      password: passwordHash,
      roles: "admin",
      isVerifiedEmail: true,
      provider: "local",
    });
  }

  const sellerUsers = [];
  const buyerUsers = [];

  for (let i = 1; i <= sellers; i++) {
    const email = `seller${i}@seed.local`;
    let u = await User.findOne({ email });
    if (!u) {
      u = await User.create({
        username: `seller_seed_${i}`,
        email,
        password: passwordHash,
        roles: "seller",
        isVerifiedEmail: true,
        provider: "local",
      });
    }
    sellerUsers.push(u);
  }

  for (let i = 1; i <= buyers; i++) {
    const email = `buyer${i}@seed.local`;
    let u = await User.findOne({ email });
    if (!u) {
      u = await User.create({
        username: `buyer_seed_${i}`,
        email,
        password: passwordHash,
        roles: "user",
        isVerifiedEmail: true,
        provider: "local",
      });
    }
    buyerUsers.push(u);
  }

  return { admin, sellerUsers, buyerUsers };
}

async function ensureShopsForSellers(sellerUsers) {
  const shops = [];
  for (const seller of sellerUsers) {
    const shopId = seller.shop;
    let shop = null;
    if (shopId) shop = await Shop.findById(shopId);
    if (!shop) {
      shop = await Shop.create({
        owner: seller._id,
        name: `${faker.company.name()} ${faker.helpers.arrayElement(["Official", "Store", "Mall"])}`,
        slug: slugify(
          `seed-${seller.username}-${crypto.randomBytes(2).toString("hex")}`,
          { lower: true, strict: true, locale: "vi" },
        ),
        logo: "",
        banner: "",
        description: faker.company.catchPhrase(),
        status: "active",
        pickupAddress: {
          fullName: faker.person.fullName(),
          phone: faker.phone.number("09########"),
          address: faker.location.streetAddress(),
          city: faker.location.city(),
          district: faker.location.city(),
          ward: faker.location.street(),
        },
      });
      await User.findByIdAndUpdate(seller._id, { shop: shop._id });
    }
    shops.push(shop);
  }
  return shops;
}

async function ensureShopCategories(shops) {
  const all = [];
  for (const shop of shops) {
    const existing = await ShopCategory.countDocuments({ shopId: shop._id });
    if (existing > 0) {
      const docs = await ShopCategory.find({ shopId: shop._id });
      all.push(...docs);
      continue;
    }

    const names = [
      "New Arrivals",
      "Best Sellers",
      "Flash Deals",
      "Phụ kiện",
      "Premium",
      "Sale Off",
    ];
    const created = [];
    for (let i = 0; i < names.length; i++) {
      created.push(
        await ShopCategory.create({
          shopId: shop._id,
          name: names[i],
          description: "",
          image: pick(unsplash),
          isActive: true,
          displayOrder: i,
        }),
      );
    }
    all.push(...created);
  }
  return all;
}

function buildVariants({ baseSlug, basePrice }) {
  const variantCount = faker.number.int({ min: 1, max: 4 });
  const colors = pickMany(
    ["Đen", "Trắng", "Đỏ", "Xanh", "Vàng", "Tím", "Hồng", "Xám"],
    variantCount,
  );

  return colors.map((color, idx) => {
    const priceBump = faker.number.int({ min: -5, max: 10 }) * 10000;
    const price = Math.max(50000, basePrice + priceBump);
    return {
      name: color,
      color,
      price,
      stock: faker.number.int({ min: 5, max: 120 }),
      sold: faker.number.int({ min: 0, max: 200 }),
      // Some DBs may have a unique index on variants.sku; keep this globally unique.
      sku: `SKU-${crypto.randomBytes(6).toString("hex").toUpperCase()}-${String(
        idx + 1,
      ).padStart(2, "0")}`,
      images: pickMany(unsplash, faker.number.int({ min: 1, max: 3 })),
    };
  });
}

function buildAttributes() {
  const keys = [
    "Chất liệu",
    "Kích thước",
    "Xuất xứ",
    "Bảo hành",
    "Hướng dẫn sử dụng",
  ];
  return pickMany(keys, faker.number.int({ min: 2, max: 4 })).map((k) => ({
    name: k,
    value: faker.commerce.productAdjective(),
  }));
}

async function seedProducts({ shops, shopCategories, categories, productsPerShop }) {
  for (const shop of shops) {
    const existing = await Product.countDocuments({ shop: shop._id });
    if (existing >= productsPerShop) continue;

    const shopCats = shopCategories.filter(
      (c) => c.shopId.toString() === shop._id.toString(),
    );

    const batch = [];
    const createCount = productsPerShop - existing;
    for (let i = 0; i < createCount; i++) {
      const name = `${faker.commerce.productName()} ${faker.string.alphanumeric(4).toUpperCase()}`;
      const slug = slugify(
        `seed-${name}-${crypto.randomBytes(2).toString("hex")}`,
        { lower: true, strict: true, locale: "vi" },
      );
      const basePrice = faker.number.int({ min: 80, max: 2000 }) * 1000;
      const discountRoll = Math.random() > 0.65;
      const discountPrice = discountRoll
        ? Math.round(basePrice * faker.number.float({ min: 0.7, max: 0.95, precision: 0.01 }))
        : null;

      const now = new Date();
      const flashSaleEnabled = Math.random() > 0.88;
      const discountPercent = flashSaleEnabled ? faker.number.int({ min: 5, max: 35 }) : null;
      const salePrice =
        flashSaleEnabled && discountPercent
          ? Math.max(1000, Math.round(basePrice * (1 - discountPercent / 100)))
          : null;

      const variants = buildVariants({ baseSlug: slug, basePrice });
      const stock = variants.reduce((s, v) => s + (v.stock || 0), 0);
      const soldFromVariants = variants.reduce((s, v) => s + (v.sold || 0), 0);
      const descImages = pickMany(unsplash, faker.number.int({ min: 1, max: 6 }));

      batch.push({
        name,
        slug,
        description: faker.commerce.productDescription(),
        shop: shop._id,
        category: pick(categories)._id,
        shopCategory: shopCats.length ? pick(shopCats)._id : undefined,
        brand: faker.company.name(),
        tags: pickMany(
          ["seed", "hot", "deal", "new", "best", "sale", "freeship", "auth"],
          faker.number.int({ min: 1, max: 4 }),
        ),
        sizes: pickMany(["S", "M", "L", "XL", "XXL"], faker.number.int({ min: 0, max: 3 })),
        descriptionImages: descImages,
        video: "",
        price: {
          currentPrice: basePrice,
          discountPrice,
          currency: "VND",
        },
        stock,
        soldCount: soldFromVariants,
        variants,
        weight: faker.number.int({ min: 100, max: 3000 }),
        dimensions: {
          height: faker.number.int({ min: 5, max: 60 }),
          width: faker.number.int({ min: 5, max: 60 }),
          length: faker.number.int({ min: 5, max: 60 }),
        },
        attributes: buildAttributes(),
        ratingAverage: faker.number.float({ min: 3.8, max: 5, precision: 0.1 }),
        reviewCount: faker.number.int({ min: 0, max: 300 }),
        flashSale: flashSaleEnabled
          ? {
              isActive: true,
              salePrice,
              discountPercent,
              stock: Math.max(1, Math.min(stock, faker.number.int({ min: 10, max: 80 }))),
              soldCount: faker.number.int({ min: 0, max: 50 }),
              startTime: new Date(now.getTime() - 60 * 60 * 1000),
              endTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
            }
          : { isActive: false },
        isFeatured: Math.random() > 0.8,
        isNewArrival: Math.random() > 0.85,
        status: "published",
      });
    }

    if (batch.length) {
      await Product.insertMany(batch, { ordered: false });
    }
  }
}

async function seedCarts(buyerUsers) {
  const products = await Product.find({ status: "published" }).select("_id shop price variants").lean();
  if (products.length === 0) return;

  for (const buyer of buyerUsers) {
    const existing = await Cart.findOne({ userId: buyer._id });
    if (existing) continue;

    const itemCount = faker.number.int({ min: 1, max: 5 });
    const picked = pickMany(products, itemCount);
    const items = picked.map((p) => {
      const variant = p.variants?.[0];
      const priceObj = p.price || { currentPrice: variant?.price || 0, discountPrice: null, currency: "VND" };
      return {
        productId: p._id,
        shopId: p.shop,
        variantId: variant?._id,
        quantity: faker.number.int({ min: 1, max: 3 }),
        price: priceObj,
      };
    });

    await Cart.create({
      userId: buyer._id,
      items,
      totalAmount: 0,
      cartCount: items.reduce((s, it) => s + it.quantity, 0),
    });
  }
}

async function seedOrdersPaymentsReviews({ buyerUsers, shops }) {
  const products = await Product.find({ status: "published" })
    .select("_id name shop category price variants descriptionImages")
    .lean();
  if (products.length === 0) return;

  const shopById = new Map(shops.map((s) => [s._id.toString(), s]));

  for (const buyer of buyerUsers) {
    // If user already has orders, skip (avoid duplication on restarts)
    const existingOrders = await Order.countDocuments({ userId: buyer._id });
    if (existingOrders > 0) continue;

    const groupCount = faker.number.int({ min: 1, max: 3 });
    for (let g = 0; g < groupCount; g++) {
      const orderGroupId = new mongoose.Types.ObjectId();
      const shopCount = faker.number.int({ min: 1, max: 2 });
      const chosenShops = pickMany(shops, shopCount);

      for (const shop of chosenShops) {
        const shopProducts = products.filter((p) => p.shop?.toString() === shop._id.toString());
        const lines = pickMany(shopProducts.length ? shopProducts : products, faker.number.int({ min: 1, max: 3 }));
        const orderLines = lines.map((p) => {
          const variant = p.variants?.[0];
          const unitPrice = variant?.price || p.price?.discountPrice || p.price?.currentPrice || 0;
          const qty = faker.number.int({ min: 1, max: 3 });
          const img = variant?.images?.[0] || p.descriptionImages?.[0] || "";
          return {
            productId: p._id,
            sku: variant?.sku,
            variantId: variant?._id || null,
            name: p.name,
            image: img,
            quantity: qty,
            price: unitPrice,
            totalPrice: unitPrice * qty,
          };
        });

        const subtotal = orderLines.reduce((s, l) => s + l.totalPrice, 0);
        const shippingFee = faker.number.int({ min: 0, max: 4 }) * 10000;
        const discountShop = faker.number.int({ min: 0, max: 2 }) * 10000;
        const discountPlatform = faker.number.int({ min: 0, max: 2 }) * 10000;
        const totalAmount = Math.max(0, subtotal + shippingFee - discountShop - discountPlatform);

        const paymentMethod = Math.random() > 0.6 ? "vnpay" : "cod";
        const paymentStatus = paymentMethod === "vnpay" ? "paid" : "unpaid";

        const order = await Order.create({
          orderGroupId,
          userId: buyer._id,
          shopId: shop._id,
          products: orderLines,
          shippingAddress: {
            fullName: faker.person.fullName(),
            phone: faker.phone.number("09########"),
            address: faker.location.streetAddress(),
            city: faker.location.city(),
            district: faker.location.city(),
            ward: faker.location.street(),
            note: "",
          },
          paymentMethod,
          paymentStatus,
          subtotal,
          shippingFee,
          discountShop,
          discountPlatform,
          totalAmount,
          status: pick(["pending", "confirmed", "processing", "shipped", "delivered"]),
        });

        if (paymentMethod === "vnpay") {
          await Payment.create({
            orderId: order._id,
            userId: buyer._id,
            amount: totalAmount,
            status: "completed",
            paymentMethod: "vnpay",
            transactionId: `VNP_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
            paymentUrl: "",
            gatewayData: null,
            paymentDate: new Date(),
          });
        } else {
          // transactionId has a unique+sparse index; do not set null (null would collide).
          await Payment.create({
            orderId: order._id,
            userId: buyer._id,
            amount: totalAmount,
            status: "pending",
            paymentMethod: "cod",
            paymentUrl: null,
            gatewayData: null,
            paymentDate: null,
          });
        }

        // Notifications (buyer + seller)
        const sellerShop = shopById.get(shop._id.toString());
        await Notification.insertMany(
          [
            {
              userId: buyer._id,
              type: "order_status",
              title: "Đơn hàng mới",
              message: `Đơn hàng ${order._id.toString().slice(-6)} đã được tạo.`,
              orderId: order._id,
              link: "/user/purchase",
              isRead: false,
            },
            {
              userId: sellerShop?.owner,
              type: "order_status",
              title: "Bạn có đơn hàng mới",
              message: `Có đơn hàng mới từ ${buyer.username}.`,
              orderId: order._id,
              link: "/seller/orders",
              isRead: false,
            },
          ].filter((n) => n.userId),
          { ordered: false },
        );

        // Conversation + messages
        const sellerUserId = sellerShop?.owner;
        if (sellerUserId) {
          const conv = await Conversation.create({
            members: [buyer._id, sellerUserId],
            shopId: shop._id,
            lastMessage: {
              content: "Chào shop, mình cần tư vấn đơn hàng.",
              senderId: buyer._id,
              createdAt: new Date(),
            },
            context: { productId: orderLines[0]?.productId, orderId: order._id },
          });

          const msgCount = faker.number.int({ min: 3, max: 8 });
          const msgs = [];
          for (let i = 0; i < msgCount; i++) {
            const fromBuyer = i % 2 === 0;
            msgs.push({
              conversationId: conv._id,
              senderId: fromBuyer ? buyer._id : sellerUserId,
              content: fromBuyer
                ? faker.helpers.arrayElement([
                    "Shop ơi, sản phẩm này còn hàng không?",
                    "Mình muốn đổi màu thì có được không?",
                    "Bao lâu thì nhận được hàng vậy shop?",
                  ])
                : faker.helpers.arrayElement([
                    "Dạ còn hàng ạ.",
                    "Shop hỗ trợ đổi màu tuỳ variant ạ.",
                    "Dự kiến 2-3 ngày là bạn nhận được nhé.",
                  ]),
              attachments: [],
              isRead: false,
            });
          }
          await Message.insertMany(msgs, { ordered: false });
        }

        // Reviews for some delivered orders
        if (order.status === "delivered" && Math.random() > 0.4) {
          for (const line of orderLines.slice(0, faker.number.int({ min: 1, max: orderLines.length }))) {
            await Review.create({
              user: buyer._id,
              product: line.productId,
              rating: faker.number.int({ min: 4, max: 5 }),
              comment: faker.helpers.arrayElement([
                "Sản phẩm đúng mô tả, đóng gói kỹ.",
                "Giao nhanh, chất lượng ổn trong tầm giá.",
                "Mua lần 2, vẫn rất hài lòng.",
              ]),
            });
          }
        }
      }
    }
  }

  // Recompute ratingAverage/reviewCount to match seeded reviews
  const stats = await Review.aggregate([
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  for (const s of stats) {
    await Product.findByIdAndUpdate(s._id, {
      ratingAverage: Math.round(s.avg * 10) / 10,
      reviewCount: s.count,
    });
  }
}

async function seedShopFollowers({ buyerUsers, shops }) {
  const existing = await ShopFollower.estimatedDocumentCount();
  if (existing > 0) return;

  const docs = [];
  for (const buyer of buyerUsers) {
    // Each buyer follows 1-3 random shops
    const followed = pickMany(shops, faker.number.int({ min: 1, max: Math.min(3, shops.length) }));
    for (const shop of followed) {
      docs.push({ shopId: shop._id, userId: buyer._id });
    }
  }

  if (docs.length) {
    await ShopFollower.insertMany(docs, { ordered: false }).catch(() => {});
    // Update followerCount cache on Shop documents
    const counts = await ShopFollower.aggregate([
      { $group: { _id: "$shopId", count: { $sum: 1 } } },
    ]);
    for (const c of counts) {
      await Shop.findByIdAndUpdate(c._id, { followerCount: c.count });
    }
  }
  console.log(`seed-dev: created ${docs.length} shop-follower relationships`);
}

async function seedWishlists({ buyerUsers }) {
  const existing = await Wishlist.estimatedDocumentCount();
  if (existing > 0) return;

  const products = await Product.find({ status: "published" }).select("_id").lean();
  if (products.length === 0) return;

  const docs = [];
  for (const buyer of buyerUsers) {
    // Each buyer wishlists 2-8 random products
    const wished = pickMany(products, faker.number.int({ min: 2, max: Math.min(8, products.length) }));
    for (const p of wished) {
      docs.push({ userId: buyer._id, productId: p._id });
    }
  }

  if (docs.length) {
    await Wishlist.insertMany(docs, { ordered: false }).catch(() => {});
  }
  console.log(`seed-dev: created ${docs.length} wishlist entries`);
}

async function main() {
  const quick = hasFlag("--quick");
  const force = hasFlag("--force");
  const reset = hasFlag("--reset");

  const sellers = quick ? 6 : parseArgInt("--sellers", 20);
  const buyers = quick ? 12 : parseArgInt("--buyers", 80);
  const productsPerShop = quick ? 25 : parseArgInt("--products-per-shop", 80);

  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI");
  }

  console.log(
    `seed-dev: quick=${quick} force=${force} reset=${reset} sellers=${sellers} buyers=${buyers} products/shop=${productsPerShop}`,
  );

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    if (reset) await hardReset();

    const clearCaches = async () => {
      // Best-effort: Redis volumes persist across runs; clear stale keys.
      await Promise.allSettled([
        cacheService.delByPattern("categories:*"),
        cacheService.delByPattern("products:*"),
        cacheService.delByPattern("flash-sale:*"),
      ]);
    };

    const productCount = await Product.estimatedDocumentCount();
    if (productCount > 0 && !force && !reset) {
      await clearCaches();
      console.log("seed-dev: products already exist, skipping (use --force or --reset).");
      return;
    }

    const categories = await ensureCategories();
    await ensureSettings();
    await ensureBanners();

    const { sellerUsers, buyerUsers } = await ensureUsers({ sellers, buyers });
    const shops = await ensureShopsForSellers(sellerUsers);
    const shopCategories = await ensureShopCategories(shops);

    await seedProducts({ shops, shopCategories, categories, productsPerShop });
    await seedCarts(buyerUsers);
    await seedOrdersPaymentsReviews({ buyerUsers, shops });
    await seedShopFollowers({ buyerUsers, shops });
    await seedWishlists({ buyerUsers });

    await clearCaches();

    console.log("seed-dev: done");
  } finally {
    await mongoose.disconnect();
    await Promise.allSettled([redis.quit?.()]);
  }
}

main().catch((err) => {
  console.error("seed-dev error:", err?.message || err);
  process.exit(1);
});
