const Product = require("../models/product.model");
const Category = require("../models/category.model");
const mongoose = require("mongoose");
const logger = require("./logger"); // Corrected path to logger

// Helper function để tìm product theo ID hoặc slug
async function findProduct(productId) {
  const isValidId = mongoose.Types.ObjectId.isValid(productId);

  if (isValidId) {
    const product = await Product.findById(productId)
      .populate("category", "name")
      .lean();
    if (product) return product;
  }

  // Tìm theo slug
  return await Product.findOne({ slug: productId })
    .populate("category", "name")
    .lean();
}

// Tool handlers với error handling
const toolHandlers = {
  async search_products({ keyword, category, minPrice, maxPrice, limit = 5 }) {
    try {
      // Note: isActive is a virtual field, use status instead
      const query = { status: "published" };

      if (keyword) {
        query.$or = [
          { name: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
          { brand: { $regex: keyword, $options: "i" } },
        ];
      }

      if (category) {
        const cat = await Category.findOne({
          name: { $regex: category, $options: "i" },
        });
        if (cat) query.category = cat._id;
      }

      if (minPrice || maxPrice) {
        query["price.currentPrice"] = {};
        if (minPrice) query["price.currentPrice"].$gte = minPrice;
        if (maxPrice) query["price.currentPrice"].$lte = maxPrice;
      }

      const products = await Product.find(query)
        .populate("category", "name")
        .select("name slug price variants brand category")
        .limit(limit)
        .lean();

      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        hasDiscount:
          p.price?.discountPrice &&
          p.price.discountPrice < p.price.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        image: p.variants?.[0]?.images?.[0] || null,
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      logger.error("[Tool] search_products error:", { error: error.message });
      return { error: "Không thể tìm kiếm sản phẩm", details: error.message };
    }
  },

  async get_product_details({ productId }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: "Không tìm thấy sản phẩm" };

      return {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price?.discountPrice || product.price?.currentPrice,
        originalPrice: product.price?.currentPrice,
        hasDiscount:
          product.price?.discountPrice &&
          product.price.discountPrice < product.price.currentPrice,
        brand: product.brand,
        category: product.category?.name,
        variants: product.variants?.map((v) => ({
          id: v._id,
          size: v.size,
          color: v.color,
          stock: v.stock,
          price: v.price?.discountPrice || v.price?.currentPrice,
          image: v.images?.[0],
        })),
        checkoutUrl: `/checkout?product=${product._id}`,
        productUrl: `/products/${product.slug}`,
      };
    } catch (error) {
      logger.error("[Tool] get_product_details error:", {
        error: error.message,
      });
      return {
        error: "Không thể lấy thông tin sản phẩm",
        details: error.message,
      };
    }
  },

  async get_categories() {
    try {
      const categories = await Category.find({ isActive: true })
        .select("name slug description")
        .lean();

      return categories.map((c) => ({
        name: c.name,
        slug: c.slug,
        url: `/categories/${c.slug}`,
      }));
    } catch (error) {
      logger.error("[Tool] get_categories error:", { error: error.message });
      return { error: "Không thể lấy danh mục" };
    }
  },

  async get_featured_products({ type = "featured", limit = 5 }) {
    try {
      // Note: isActive and onSale are virtual fields, use status and price conditions instead
      const query = { status: "published" };
      let sort = { soldCount: -1 };

      if (type === "featured") {
        query.isFeatured = true;
      } else if (type === "newArrivals") {
        query.isNewArrival = true;
        sort = { createdAt: -1 };
      } else if (type === "onSale") {
        // onSale is a virtual field - we need to query the actual price fields
        // Products with discountPrice < currentPrice
        query["price.discountPrice"] = { $exists: true, $ne: null };
        query.$expr = { $lt: ["$price.discountPrice", "$price.currentPrice"] };
      }

      const products = await Product.find(query)
        .populate("category", "name")
        .select("name slug price variants brand")
        .sort(sort)
        .limit(limit)
        .lean();

      // Fallback: if query returns empty, get any published products
      if (products.length === 0 && (type === "featured" || type === "newArrivals")) {
        logger.info(`[Tool] No ${type} products found, falling back to all products`);
        const fallbackProducts = await Product.find({ status: "published" })
          .populate("category", "name")
          .select("name slug price variants brand")
          .sort({ soldCount: -1 })
          .limit(limit)
          .lean();
        
        return fallbackProducts.map((p) => ({
          id: p._id,
          name: p.name,
          slug: p.slug,
          price: p.price?.discountPrice || p.price?.currentPrice,
          originalPrice: p.price?.currentPrice,
          brand: p.brand,
          image: p.variants?.[0]?.images?.[0] || null,
          checkoutUrl: `/checkout?product=${p._id}`,
          productUrl: `/products/${p.slug}`,
        }));
      }

      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        brand: p.brand,
        image: p.variants?.[0]?.images?.[0] || null,
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      logger.error("[Tool] get_featured_products error:", {
        error: error.message,
      });
      return { error: "Không thể lấy sản phẩm nổi bật" };
    }
  },

  async check_product_availability({ productId, size, color }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: "Không tìm thấy sản phẩm" };

      let variants = product.variants || [];

      if (size)
        variants = variants.filter(
          (v) => v.size?.toLowerCase() === size.toLowerCase(),
        );
      if (color)
        variants = variants.filter(
          (v) => v.color?.toLowerCase() === color.toLowerCase(),
        );

      const available = variants.filter((v) => v.stock > 0);

      return {
        productName: product.name,
        productSlug: product.slug,
        available: available.length > 0,
        variants: available.map((v) => ({
          id: v._id,
          size: v.size,
          color: v.color,
          stock: v.stock,
          price: v.price?.discountPrice || v.price?.currentPrice,
        })),
        totalStock: available.reduce((sum, v) => sum + v.stock, 0),
        message:
          available.length > 0
            ? `Còn ${available.reduce((sum, v) => sum + v.stock, 0)} sản phẩm`
            : "Hết hàng",
        checkoutUrl:
          available.length > 0
            ? `/checkout?product=${product._id}&variant=${available[0]._id}`
            : null,
        productUrl: `/products/${product.slug}`,
      };
    } catch (error) {
      logger.error("[Tool] check_product_availability error:", {
        error: error.message,
      });
      return { error: "Không thể kiểm tra tồn kho" };
    }
  },

  async generate_checkout_link({ productId, variantId, quantity = 1 }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: "Không tìm thấy sản phẩm" };

      let checkoutUrl = `/checkout?product=${product._id}&quantity=${quantity}`;
      if (variantId) checkoutUrl += `&variant=${variantId}`;

      const variant = variantId
        ? product.variants?.find((v) => v._id.toString() === variantId)
        : product.variants?.[0];

      return {
        checkoutUrl,
        addToCartUrl: `/cart/add?product=${product._id}${variantId ? `&variant=${variantId}` : ""}&quantity=${quantity}`,
        productUrl: `/products/${product.slug}`,
        product: {
          name: product.name,
          slug: product.slug,
          price:
            variant?.price?.discountPrice ||
            variant?.price?.currentPrice ||
            product.price?.currentPrice,
          variant: variant
            ? { size: variant.size, color: variant.color }
            : null,
          quantity,
        },
        message: "Nhấn vào link để tiến hành thanh toán ngay!",
      };
    } catch (error) {
      logger.error("[Tool] generate_checkout_link error:", {
        error: error.message,
      });
      return { error: "Không thể tạo link thanh toán" };
    }
  },

  async compare_products({ productIds }) {
    try {
      const products = [];

      for (const id of productIds) {
        const product = await findProduct(id);
        if (product) products.push(product);
      }

      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        sizes: [...new Set(p.variants?.map((v) => v.size).filter(Boolean))],
        colors: [...new Set(p.variants?.map((v) => v.color).filter(Boolean))],
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      logger.error("[Tool] compare_products error:", { error: error.message });
      return { error: "Không thể so sánh sản phẩm" };
    }
  },
};

module.exports = { toolHandlers };
