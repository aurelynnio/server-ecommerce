require("dotenv").config();
const connectDB = require("../src/db/connect.db");
const Category = require("../src/models/category.model");
const slugify = require("slugify");

const translations = {
  "Điện tử & Công nghệ": "Electronics & Technology",
  "Thời trang Nam": "Men's Fashion",
  "Giày dép": "Shoes",
  "Phụ kiện": "Accessories",
  "Đồng hồ & Trang sức": "Watches & Jewelry",
  "Nhà cửa & Đời sống": "Home & Living",
  "Làm đẹp & Sức khỏe": "Beauty & Health",
  "Thời trang Nữ": "Women's Fashion",
  "Thể thao & Dã ngoại": "Sports & Outdoors",
  "Xe cộ & Phương tiện": "Automotive",
  "Áo sơ mi Nam": "Men's Shirts",
  "Boots": "Boots",
  "Mũ & Nón": "Hats & Caps",
  "Đồng hồ Nam": "Men's Watches",
  "Nhẫn Cưới": "Wedding Rings",
  "Thiết bị thể thao": "Sports Equipment",
  "Quần short Nam": "Men's Shorts",
  "Áo sơ mi Nữ": "Women's Shirts",
  "Giày thể thao": "Sneakers",
  "Sandal & Dép": "Sandals & Slippers",
  "Túi xách": "Handbags",
  "Dây chuyền & Vòng cổ": "Necklaces",
  "Đồ dã ngoại": "Camping Gear",
  "Áo thun Nam": "Men's T-Shirts",
  "Áo thun Nữ": "Women's T-Shirts",
  "Quần dài Nữ": "Women's Pants",
  "Balo": "Backpacks",
  "Quần dài Nam": "Men's Pants",
  "Váy": "Dresses",
  "Chân váy": "Skirts",
  "Áo khoác Nữ": "Women's Jackets",
  "Giày da Nam": "Men's Leather Shoes",
  "Ví & Clutch": "Wallets & Clutches",
  "Thắt lưng": "Belts",
  "Đồng hồ Nữ": "Women's Watches",
  "iPhone 16 Pro Max": "iPhone 16 Pro Max"
};

const run = async () => {
  try {
    await connectDB();
    const categories = await Category.find({});
    
    for (const cat of categories) {
        if (translations[cat.name]) {
            const newName = translations[cat.name];
            const newSlug = slugify(newName, { lower: true });
            
            console.log(`Updating "${cat.name}" -> "${newName}" (slug: ${newSlug})`);
            
            cat.name = newName;
            cat.slug = newSlug;
            // Optional: Clear description if it's Vietnamese since we don't have translations
            // cat.description = ""; 
            try {
                await cat.save();
            } catch (err) {
                console.error(`Failed to save ${newName}: ${err.message}`);
            }
        } else {
             console.log(`No translation for "${cat.name}", skipping.`);
        }
    }
    
    console.log("Translation complete.");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
