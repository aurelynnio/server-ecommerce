const SYSTEM_PROMPT = `Bạn là Mia - AI Sales Assistant của cửa hàng thời trang trực tuyến.

## QUY TẮC TUYỆT ĐỐI - KHÔNG ĐƯỢC VI PHẠM

### 1. VỀ SẢN PHẨM
- CHỈ giới thiệu sản phẩm có trong phần "DỮ LIỆU SẢN PHẨM THỰC TẾ"
- TUYỆT ĐỐI KHÔNG được bịa/tạo/tưởng tượng ra bất kỳ sản phẩm nào
- TUYỆT ĐỐI KHÔNG được bịa giá, tên, link sản phẩm
- Nếu KHÔNG có dữ liệu sản phẩm → hỏi khách muốn tìm gì cụ thể

### 2. VỀ GIÁ CẢ
- CHỈ sử dụng ĐÚNG giá từ dữ liệu được cung cấp
- KHÔNG được làm tròn, ước lượng, hay thay đổi giá
- KHÔNG được bịa giá nếu không có trong dữ liệu

### 3. VỀ LINK
- CHỈ dùng ĐÚNG link productUrl và checkoutUrl từ dữ liệu
- KHÔNG được tự tạo link

### 4. KHI KHÔNG CÓ DỮ LIỆU PHÙ HỢP
Nếu không có sản phẩm trong dữ liệu hoặc dữ liệu rỗng:
- Xin lỗi khách: "Em xin lỗi, hiện tại em chưa tìm thấy sản phẩm phù hợp"
- Hỏi khách mô tả rõ hơn: "Anh/chị có thể cho em biết cụ thể hơn..."
- KHÔNG bịa sản phẩm để trả lời

## CÁCH GIỚI THIỆU SẢN PHẨM (chỉ khi có dữ liệu)

Với mỗi sản phẩm trong dữ liệu, format như sau:

**[Tên sản phẩm CHÍNH XÁC từ dữ liệu]**
- Giá: [Giá CHÍNH XÁC từ dữ liệu]đ
- Thương hiệu: [Brand từ dữ liệu]
- [Xem chi tiết]([productUrl]) | [Mua ngay]([checkoutUrl])

## PHONG CÁCH GIAO TIẾP
- Xưng "em", gọi khách là "anh/chị"
- Thân thiện, nhiệt tình nhưng ngắn gọn
- Luôn kèm link mua hàng khi giới thiệu sản phẩm
- Không dùng emoji quá nhiều

## VÍ DỤ ĐÚNG

Khi có dữ liệu sản phẩm:
"Dạ chào anh/chị! Em có một số sản phẩm phù hợp với yêu cầu của anh/chị:

**Áo Thun Basic Cotton**
- Giá: 299.000đ
- Thương hiệu: Uniqlo
- [Xem chi tiết](/products/ao-thun-basic-cotton) | [Mua ngay](/checkout?product=123)

Anh/chị muốn xem thêm thông tin sản phẩm nào ạ?"

## VÍ DỤ SAI (TUYỆT ĐỐI TRÁNH)

- Bịa tên sản phẩm không có trong dữ liệu
- Bịa giá: "khoảng 300k", "từ 200-500k"  
- Bịa link: "/products/ao-dep" (không có trong dữ liệu)
- Nói "có nhiều sản phẩm" khi dữ liệu rỗng`;

// Định nghĩa các tools cho AI
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Tìm kiếm sản phẩm theo từ khóa, danh mục, giá. Dùng khi khách hỏi về sản phẩm.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm" },
          category: { type: "string", description: "Tên danh mục" },
          minPrice: { type: "number", description: "Giá tối thiểu" },
          maxPrice: { type: "number", description: "Giá tối đa" },
          limit: {
            type: "number",
            description: "Số lượng kết quả",
            default: 5,
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products_advanced",
      description:
        "Tìm kiếm sản phẩm nâng cao theo nhiều bộ lọc: từ khóa, danh mục, thương hiệu, khoảng giá, màu, size, tồn kho, giảm giá, sắp xếp.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm" },
          category: { type: "string", description: "Tên/slug danh mục" },
          brand: { type: "string", description: "Thương hiệu sản phẩm" },
          minPrice: { type: "number", description: "Giá tối thiểu" },
          maxPrice: { type: "number", description: "Giá tối đa" },
          colors: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách màu cần lọc",
          },
          sizes: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách size cần lọc",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách tag cần lọc",
          },
          inStockOnly: {
            type: "boolean",
            description: "Chỉ lấy sản phẩm còn hàng",
          },
          onlyDiscounted: {
            type: "boolean",
            description: "Chỉ lấy sản phẩm đang giảm giá",
          },
          sortBy: {
            type: "string",
            enum: ["bestselling", "newest", "price_asc", "price_desc", "rating"],
            description: "Kiểu sắp xếp kết quả",
          },
          limit: { type: "number", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products_by_brand",
      description:
        "Tìm kiếm nhanh sản phẩm theo thương hiệu, có thể kết hợp từ khóa và khoảng giá.",
      parameters: {
        type: "object",
        properties: {
          brand: { type: "string", description: "Tên thương hiệu" },
          keyword: { type: "string", description: "Từ khóa bổ sung" },
          minPrice: { type: "number", description: "Giá tối thiểu" },
          maxPrice: { type: "number", description: "Giá tối đa" },
          sortBy: {
            type: "string",
            enum: ["bestselling", "newest", "price_asc", "price_desc", "rating"],
            description: "Kiểu sắp xếp kết quả",
          },
          limit: { type: "number", default: 5 },
        },
        required: ["brand"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products_by_price_range",
      description:
        "Tìm sản phẩm theo ngân sách/khoảng giá, có thể kết hợp từ khóa và danh mục.",
      parameters: {
        type: "object",
        properties: {
          minPrice: { type: "number", description: "Giá tối thiểu" },
          maxPrice: { type: "number", description: "Giá tối đa" },
          keyword: { type: "string", description: "Từ khóa bổ sung" },
          category: { type: "string", description: "Tên/slug danh mục" },
          sortBy: {
            type: "string",
            enum: ["bestselling", "newest", "price_asc", "price_desc", "rating"],
            description: "Kiểu sắp xếp kết quả",
          },
          limit: { type: "number", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_discounted_products",
      description:
        "Lấy danh sách sản phẩm đang giảm giá, có thể lọc theo danh mục/từ khóa và mức giảm tối thiểu.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa sản phẩm" },
          category: { type: "string", description: "Tên/slug danh mục" },
          minDiscountPercent: {
            type: "number",
            description: "Phần trăm giảm tối thiểu",
            default: 5,
          },
          inStockOnly: {
            type: "boolean",
            description: "Chỉ lấy sản phẩm còn hàng",
            default: true,
          },
          limit: { type: "number", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bestseller_products",
      description:
        "Lấy danh sách sản phẩm bán chạy theo danh mục hoặc thương hiệu.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Tên/slug danh mục" },
          brand: { type: "string", description: "Thương hiệu sản phẩm" },
          limit: { type: "number", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_new_arrival_products",
      description:
        "Lấy danh sách sản phẩm mới nhất theo danh mục hoặc thương hiệu.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Tên/slug danh mục" },
          brand: { type: "string", description: "Thương hiệu sản phẩm" },
          limit: { type: "number", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_related_products",
      description:
        "Lấy danh sách sản phẩm liên quan dựa trên sản phẩm gốc (cùng danh mục/thương hiệu).",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "ID hoặc slug sản phẩm gốc" },
          limit: { type: "number", default: 5 },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_search_filter_options",
      description:
        "Lấy danh sách bộ lọc khả dụng (brand, category, màu, size, khoảng giá) từ tập sản phẩm phù hợp.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Từ khóa tìm kiếm" },
          category: { type: "string", description: "Tên/slug danh mục" },
          brand: { type: "string", description: "Thương hiệu sản phẩm" },
          minPrice: { type: "number", description: "Giá tối thiểu" },
          maxPrice: { type: "number", description: "Giá tối đa" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description:
        "Lấy chi tiết sản phẩm theo ID hoặc slug. Dùng khi khách muốn biết thêm về sản phẩm cụ thể.",
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
      description:
        "Lấy danh sách các danh mục sản phẩm. Dùng khi khách muốn xem có những loại sản phẩm gì.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_featured_products",
      description:
        "Lấy sản phẩm nổi bật, bán chạy. Dùng khi khách chưa biết mua gì hoặc muốn gợi ý.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["featured", "newArrivals", "onSale"],
            description:
              "Loại sản phẩm: featured (nổi bật), newArrivals (mới), onSale (giảm giá)",
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
      description:
        "Kiểm tra tồn kho sản phẩm theo size/màu. Dùng khi khách hỏi còn hàng không.",
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
      description:
        "Tạo link checkout cho sản phẩm. LUÔN DÙNG khi khách muốn mua hoặc đã quyết định.",
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
      description:
        "So sánh 2-3 sản phẩm. Dùng khi khách phân vân giữa các lựa chọn.",
      parameters: {
        type: "object",
        properties: {
          productIds: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách ID sản phẩm cần so sánh",
          },
        },
        required: ["productIds"],
      },
    },
  },
];

module.exports = { SYSTEM_PROMPT, toolDefinitions };
