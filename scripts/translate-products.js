require("dotenv").config();
const connectDB = require("../src/db/connect.db");
const Product = require("../src/models/product.model");
const slugify = require("slugify");

// Translation Dictionary for 21 Products
const productTranslations = {
  "690edbe44726a83ac9eb71db": {
    name: "Premium Cotton Men's Polo Shirt",
    description: "Men's polo shirt made of 100% cotton, regular fit, good sweat absorption. Suitable for office environment and streetwear.",
    tags: ["polo", "men", "cotton", "office", "casual"],
    variants: {
      "Trắng": "White",
      "Xanh Navy": "Navy Blue",
      "Đen": "Black"
    }
  },
  "690edbf34726a83ac9eb71e6": {
    name: "Elegant Women's Office Dress",
    description: "Elegant women's dress, high-quality fabric, fitted form. Suitable for office environment and light parties.",
    tags: ["dress", "women", "office", "elegant", "premium"],
    variants: {
      "Đỏ": "Red",
      "Đen": "Black",
      "Xanh": "Blue"
    }
  },
  "690edc124726a83ac9eb71f1": {
    name: "Basic White Women's Shirt",
    description: "Basic white women's shirt, soft cotton material, easy to coordinate. Essential item for every girl's wardrobe.",
    tags: ["shirt", "women", "white", "basic", "cotton"],
    variants: {}
  },
  "690edd020b55c884676abd32": {
    name: "Basic Round Neck Men's T-Shirt",
    description: "Men's round neck T-shirt made of 100% cotton, comfortable regular fit. Diverse colors, easy to coordinate for any occasion.",
    tags: ["t-shirt", "men", "round neck", "cotton", "basic"],
    variants: {
      "Đỏ": "Red",
      "Xanh": "Blue",
      "Trắng": "White"
    }
  },
  "690edd090b55c884676abd3d": {
    name: "Men's Poly Sports Shorts",
    description: "Men's shorts made of breathable polyester material, dynamic design. Suitable for gym, jogging and sports activities.",
    tags: ["shorts", "men", "sports", "polyester", "gym"],
    variants: {
      "Đen": "Black",
      "Xanh Navy": "Navy Blue"
    }
  },
  "690edd100b55c884676abd46": {
    name: "Vintage Long Sleeve Women's Blouse",
    description: "Vintage style long sleeve women's blouse, soft chiffon material. Feminine design with delicate small floral pattern.",
    tags: ["blouse", "women", "long sleeve", "vintage", "chiffon"],
    variants: {
      "Hoa nhỏ": "Small Floral"
    }
  },
  "690edd170b55c884676abd4f": {
    name: "Slim Fit Men's Office Khaki Pants",
    description: "Slim fit men's khaki pants, stretchy cotton spandex material. Elegant design, suitable for office environment and meeting partners.",
    tags: ["khaki", "men", "office", "slim fit", "cotton"],
    variants: {
      "Be": "Beige",
      "Xanh Navy": "Navy Blue",
      "Đen": "Black"
    }
  },
  "690edd200b55c884676abd5a": {
    name: "A-line Midi Women's Skirt",
    description: "A-line midi women's skirt, high-quality snow rain fabric. Elegant design, flattering for all body shapes.",
    tags: ["skirt", "women", "a-line", "midi", "elegant"],
    variants: {}
  },
  "690edd270b55c884676abd5f": {
    name: "Women's Office Blazer",
    description: "Women's blazer made of high-quality polyester, fitted form. Essential item for professional office style.",
    tags: ["blazer", "women", "office", "professional", "polyester"],
    variants: {
      "Đen": "Black",
      "Xám": "Gray"
    }
  },
  "690edd2f0b55c884676abd68": {
    name: "Women's Bikini Set",
    description: "Youthful women's bikini set, good stretch lycra material. UV resistant, quick drying, suitable for beach and pool.",
    tags: ["swimwear", "women", "bikini", "lycra", "beach"],
    variants: {
      "Đỏ": "Red",
      "Xanh": "Blue"
    }
  },
  "690eddff0b55c884676abd71": {
    name: "Premium Cotton Men's Socks",
    description: "Set of 5 pairs of men's socks made of natural cotton, good sweat absorption. Basic design suitable for all types of shoes and occasions.",
    tags: ["socks", "men", "cotton", "basic", "5 pairs"],
    variants: {}
  },
  "690ede060b55c884676abd76": {
    name: "Men's Boxer Briefs",
    description: "Set of 3 men's boxer briefs made of premium modal, soft and breathable. Fitted form, comfortable all day.",
    tags: ["underwear", "men", "boxer", "modal", "3 pieces"],
    variants: {}
  },
  "690ede0b0b55c884676abd7b": {
    name: "Women's Wireless Bra",
    description: "Women's wireless bra made of cotton spandex, comfortable and natural. Seamless design, no visible lines under clothes.",
    tags: ["bra", "women", "wireless", "cotton", "seamless"],
    variants: {}
  },
  "690ede110b55c884676abd80": {
    name: "Men's Snapback Cap",
    description: "Snapback style men's cap, durable cotton twill material. Modern streetwear design with raised embroidered logo.",
    tags: ["cap", "men", "snapback", "cotton", "streetwear"],
    variants: {}
  },
  "690ede170b55c884676abd85": {
    name: "Women's Silk Scarf",
    description: "Women's scarf made of premium silk, exquisite floral pattern. Perfect accessory for elegant and luxurious style.",
    tags: ["scarf", "women", "silk", "premium", "floral"],
    variants: {}
  },
  "690ede1d0b55c884676abd8a": {
    name: "Women's Floral Chiffon Kimono",
    description: "Women's kimono made of light chiffon, beautiful floral pattern. Comfortable oversized design, suitable as a robe or beach cover-up.",
    tags: ["kimono", "women", "chiffon", "floral", "oversized"],
    variants: {}
  },
  "690ede220b55c884676abd8f": {
    name: "Men's Chelsea Boots",
    description: "Men's Chelsea boots made of genuine cowhide, durable and sturdy. Classic design, easy to coordinate with jeans or khaki.",
    tags: ["boots", "men", "chelsea", "leather", "classic"],
    variants: {
      "Nâu": "Brown",
      "Đen": "Black"
    }
  },
  "690ede8d0b55c884676abd94": {
    name: "Men's Oxford Shoes",
    description: "Men's Oxford shoes made of high-quality synthetic leather, elegant and polite. Suitable for office environment and events.",
    tags: ["shoes", "men", "oxford", "leather", "office"],
    variants: {
      "Đen": "Black",
      "Nâu Đỏ": "Reddish Brown"
    }
  },
  "690ede980b55c884676abd99": {
    name: "Women's Organic Cotton Tank Top",
    description: "Women's tank top made of eco-friendly organic cotton, fitted form. Suitable for layering or mixing and matching with other outfits.",
    tags: ["tank top", "women", "organic cotton", "fitted", "eco-friendly"],
    variants: {
      "Trắng": "White",
      "Đen": "Black"
    }
  },
  "690edea30b55c884676abda2": {
    name: "Men's Pajama Set",
    description: "Men's pajama set made of soft, breathable cotton. Comfortable design with short sleeves and long pants, suitable for all seasons.",
    tags: ["pajamas", "men", "pijama", "cotton", "set"],
    variants: {
      "Xanh": "Blue",
      "Xám": "Gray"
    }
  },
  "690edeae0b55c884676abdab": {
    name: "Unisex Crop Top Baby Tee",
    description: "Unisex crop top baby tee, slightly stretchy cotton material. Basic design with many trendy colors, suitable for gen Z style.",
    tags: ["baby tee", "unisex", "crop top", "cotton", "gen z"],
    variants: {
      "Hồng": "Pink",
      "Xanh mint": "Mint Green"
    }
  },
  "690edec90b55c884676abdbd": {
    name: "High Waist Women's Yoga Leggings",
    description: "High waist women's yoga leggings made of 4-way stretch spandex. Body-hugging design, comfortable for yoga and gym.",
    tags: ["leggings", "women", "yoga", "high waist", "spandex"],
    variants: {
      "Đen": "Black",
      "Xanh navy": "Navy Blue"
    }
  },
  "690eded00b55c884676abdc6": {
    name: "Unisex Foam Comfort Slides",
    description: "Unisex slides made of ultra-light and soft foam, non-slip. Minimalist design, suitable for indoor and outdoor wear.",
    tags: ["slides", "unisex", "foam", "comfort", "minimalist"],
    variants: {
      "Trắng": "White",
      "Đen": "Black"
    }
  }
};

const run = async () => {
  try {
    await connectDB();
    const products = await Product.find({});
    
    for (const product of products) {
        if (productTranslations[product._id]) {
            const trans = productTranslations[product._id];
            
            console.log(`Updating "${product.name}" -> "${trans.name}"`);
            
            product.name = trans.name;
            product.description = trans.description;
            product.slug = slugify(trans.name, { lower: true, strict: true });
            
            // Update Tags
            if (trans.tags) {
                product.tags = trans.tags;
            }

            // Update Variant Colors
            if (product.variants && product.variants.length > 0 && trans.variants) {
                product.variants.forEach(variant => {
                    if (variant.color && trans.variants[variant.color]) {
                       // Update SKU if it contains the Vietnamese color name? 
                       // Risk: SKU is unique and might break refs. Better leave SKU alone or just update color display.
                       // Updating only display color.
                       const oldColor = variant.color;
                       variant.color = trans.variants[oldColor];
                       console.log(`  Variant: ${oldColor} -> ${variant.color}`);
                    }
                });
            }

            try {
                await product.save();
            } catch (err) {
                console.error(`Failed to save ${product.name}: ${err.message}`);
            }
        } else {
             console.log(`No translation for ID: ${product._id} (${product.name})`);
        }
    }
    
    console.log("Product translation complete.");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
