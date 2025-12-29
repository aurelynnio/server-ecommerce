const Product = require("../models/product.model");
const Category = require("../models/category.model");
const mongoose = require("mongoose");

// Định nghĩa các tools cho AI
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Tìm kiếm sản phẩm theo từ khóa, danh mục, giá. Dùng khi khách hỏi về sản phẩm.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm" },
          category: { type: "string", description: "Tên danh mục" },
          minPrice: { type: "number", description: "Giá tối thiểu" },
          maxPrice: { type: "number", description: "Giá tối đa" },
          limit: { type: "number", description: "Số lượng kết quả", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Lấy chi tiết sản phẩm theo ID hoặc slug. Dùng khi khách muốn biết thêm về sản phẩm cụ thể.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "ID hoặc slug sản phẩm" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_categories",
      description: "Lấy danh sách các danh mục sản phẩm. Dùng khi khách muốn xem có những loại sản phẩm gì.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_featured_products",
      description: "Lấy sản phẩm nổi bật, bán chạy. Dùng khi khách chưa biết mua gì hoặc muốn gợi ý.",
      parameters: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["featured", "newArrivals", "onSale"],
            description: "Loại sản phẩm: featured (nổi bật), newArrivals (mới), onSale (giảm giá)"
          },
          limit: { type: "number", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_product_availability",
      description: "Kiểm tra tồn kho sản phẩm theo size/màu. Dùng khi khách hỏi còn hàng không.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "ID hoặc slug sản phẩm" },
          size: { type: "string", description: "Size cần kiểm tra" },
          color: { type: "string", description: "Màu cần kiểm tra" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function", 
    function: {
      name: "generate_checkout_link",
      description: "Tạo link checkout cho sản phẩm. LUÔN DÙNG khi khách muốn mua hoặc đã quyết định.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "ID hoặc slug sản phẩm" },
          variantId: { type: "string", description: "ID variant (size/màu)" },
          quantity: { type: "number", default: 1 },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_products",
      description: "So sánh 2-3 sản phẩm. Dùng khi khách phân vân giữa các lựa chọn.",
      parameters: {
        type: "object",
        properties: {
          productIds: { 
            type: "array", 
            items: { type: "string" },
            description: "Danh sách ID sản phẩm cần so sánh" 
          },
        },
        required: ["productIds"],
      },
    },
  },
];

// Helper function để tìm product theo ID hoặc slug
async function findProduct(productId) {
  const isValidId = mongoose.Types.ObjectId.isValid(productId);
  
  if (isValidId) {
    const product = await Product.findById(productId).populate("category", "name").lean();
    if (product) return product;
  }
  
  // Tìm theo slug
  return await Product.findOne({ slug: productId }).populate("category", "name").lean();
}

// Tool handlers với error handling
const toolHandlers = {
  async search_products({ keyword, category, minPrice, maxPrice, limit = 5 }) {
    try {
      const query = { isActive: true };
      
      if (keyword) {
        query.$or = [
          { name: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
          { brand: { $regex: keyword, $options: "i" } },
        ];
      }
      
      if (category) {
        const cat = await Category.findOne({ 
          name: { $regex: category, $options: "i" } 
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

      return products.map(p => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        hasDiscount: p.price?.discountPrice && p.price.discountPrice < p.price.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        image: p.variants?.[0]?.images?.[0] || null,
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      console.error("[Tool] search_products error:", error.message);
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
        hasDiscount: product.price?.discountPrice && product.price.discountPrice < product.price.currentPrice,
        brand: product.brand,
        category: product.category?.name,
        variants: product.variants?.map(v => ({
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
      console.error("[Tool] get_product_details error:", error.message);
      return { error: "Không thể lấy thông tin sản phẩm", details: error.message };
    }
  },

  async get_categories() {
    try {
      const categories = await Category.find({ isActive: true })
        .select("name slug description")
        .lean();
      
      return categories.map(c => ({
        name: c.name,
        slug: c.slug,
        url: `/categories/${c.slug}`,
      }));
    } catch (error) {
      console.error("[Tool] get_categories error:", error.message);
      return { error: "Không thể lấy danh mục" };
    }
  },

  async get_featured_products({ type = "featured", limit = 5 }) {
    try {
      const query = { isActive: true };
      
      if (type === "featured") query.isFeatured = true;
      else if (type === "newArrivals") query.isNewArrival = true;
      else if (type === "onSale") query.onSale = true;

      const products = await Product.find(query)
        .populate("category", "name")
        .select("name slug price variants brand")
        .sort({ soldCount: -1 })
        .limit(limit)
        .lean();

      return products.map(p => ({
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
      console.error("[Tool] get_featured_products error:", error.message);
      return { error: "Không thể lấy sản phẩm nổi bật" };
    }
  },

  async check_product_availability({ productId, size, color }) {
    try {
      const product = await findProduct(productId);
      if (!product) return { error: "Không tìm thấy sản phẩm" };

      let variants = product.variants || [];
      
      if (size) variants = variants.filter(v => v.size?.toLowerCase() === size.toLowerCase());
      if (color) variants = variants.filter(v => v.color?.toLowerCase() === color.toLowerCase());

      const available = variants.filter(v => v.stock > 0);
      
      return {
        productName: product.name,
        productSlug: product.slug,
        available: available.length > 0,
        variants: available.map(v => ({
          id: v._id,
          size: v.size,
          color: v.color,
          stock: v.stock,
          price: v.price?.discountPrice || v.price?.currentPrice,
        })),
        totalStock: available.reduce((sum, v) => sum + v.stock, 0),
        message: available.length > 0 
          ? `Còn ${available.reduce((sum, v) => sum + v.stock, 0)} sản phẩm` 
          : "Hết hàng",
        checkoutUrl: available.length > 0 ? `/checkout?product=${product._id}&variant=${available[0]._id}` : null,
        productUrl: `/products/${product.slug}`,
      };
    } catch (error) {
      console.error("[Tool] check_product_availability error:", error.message);
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
        ? product.variants?.find(v => v._id.toString() === variantId)
        : product.variants?.[0];

      return {
        checkoutUrl,
        addToCartUrl: `/cart/add?product=${product._id}${variantId ? `&variant=${variantId}` : ''}&quantity=${quantity}`,
        productUrl: `/products/${product.slug}`,
        product: {
          name: product.name,
          slug: product.slug,
          price: variant?.price?.discountPrice || variant?.price?.currentPrice || product.price?.currentPrice,
          variant: variant ? { size: variant.size, color: variant.color } : null,
          quantity,
        },
        message: "Nhấn vào link để tiến hành thanh toán ngay!",
      };
    } catch (error) {
      console.error("[Tool] generate_checkout_link error:", error.message);
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

      return products.map(p => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        sizes: [...new Set(p.variants?.map(v => v.size).filter(Boolean))],
        colors: [...new Set(p.variants?.map(v => v.color).filter(Boolean))],
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    } catch (error) {
      console.error("[Tool] compare_products error:", error.message);
      return { error: "Không thể so sánh sản phẩm" };
    }
  },
};

module.exports = { toolDefinitions, toolHandlers };
