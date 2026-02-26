/**
 * Unit Tests: Chatbot Service
 * Tests pure logic: buildContextMessage, formatProducts, validateResponse
 */
import { describe, it, expect } from "vitest";

// Can't import the full service (LangChain constructor runs), so test logic directly
describe("ChatbotService Logic", () => {
  // Re-implement pure functions from chatbot.service.js for testing
  const formatProducts = (products) => {
    if (!Array.isArray(products) || products.length === 0) {
      return "Không có sản phẩm.";
    }

    return products
      .map((item, index) => {
        if (item.name && item.price !== undefined) {
          const discount =
            item.originalPrice && item.originalPrice > item.price
              ? ` (gốc ${item.originalPrice.toLocaleString("vi-VN")}đ, giảm ${Math.round((1 - item.price / item.originalPrice) * 100)}%)`
              : "";
          const similarity = item.score
            ? ` [Độ phù hợp: ${(item.score * 100).toFixed(0)}%]`
            : "";

          return `[SẢN PHẨM ${index + 1}]${similarity}
Tên: ${item.name}
Giá: ${item.price?.toLocaleString("vi-VN")}đ${discount}
Thương hiệu: ${item.brand || "N/A"}
Danh mục: ${item.category || "N/A"}
Còn hàng: ${item.stock > 0 ? "Có" : "Hết hàng"}
Link xem: ${item.productUrl}
Link mua: ${item.checkoutUrl}`;
        } else if (item.name && item.slug && item.url) {
          return `- ${item.name}: ${item.url}`;
        }
        return JSON.stringify(item);
      })
      .join("\n\n");
  };

  const buildContextMessage = (userMessage, products) => {
    if (products && Array.isArray(products) && products.length > 0) {
      const formattedData = formatProducts(products);
      return `[KHÁCH HỎI]: ${userMessage}\n\n[DỮ LIỆU SẢN PHẨM THỰC TẾ - CHỈ DÙNG THÔNG TIN NÀY]:\n${formattedData}`;
    }
    return `[KHÁCH HỎI]: ${userMessage}\n\n[THÔNG BÁO]: Không tìm thấy sản phẩm phù hợp trong hệ thống.`;
  };

  const validateResponse = (response, products) => {
    if (!products || products.length === 0) {
      const pricePattern = /\d{2,3}[.,]?\d{3}[.,]?\d{0,3}\s*đ/g;
      const hasPrices = pricePattern.test(response);
      if (hasPrices) {
        return "Em xin lỗi, hiện tại em chưa tìm thấy sản phẩm phù hợp với yêu cầu của anh/chị. Anh/chị có thể cho em biết cụ thể hơn muốn tìm loại sản phẩm gì không ạ? Ví dụ: áo, quần, giày, túi xách...";
      }
    }
    return response;
  };

  describe("formatProducts()", () => {
    it("should return fallback for empty array", () => {
      expect(formatProducts([])).toBe("Không có sản phẩm.");
    });

    it("should return fallback for non-array", () => {
      expect(formatProducts(null)).toBe("Không có sản phẩm.");
    });

    it("should format product with all fields", () => {
      const products = [
        {
          name: "Áo thun nam",
          price: 200000,
          brand: "Nike",
          category: "Áo",
          stock: 50,
          productUrl: "/products/ao-thun-nam",
          checkoutUrl: "/checkout?product=123",
        },
      ];
      const result = formatProducts(products);
      expect(result).toContain("[SẢN PHẨM 1]");
      expect(result).toContain("Tên: Áo thun nam");
      expect(result).toContain("Thương hiệu: Nike");
      expect(result).toContain("Còn hàng: Có");
      expect(result).toContain("/products/ao-thun-nam");
    });

    it("should show out of stock", () => {
      const products = [
        {
          name: "Test",
          price: 100000,
          stock: 0,
          productUrl: "/p",
          checkoutUrl: "/c",
        },
      ];
      const result = formatProducts(products);
      expect(result).toContain("Hết hàng");
    });

    it("should calculate discount percentage", () => {
      const products = [
        {
          name: "Sale Item",
          price: 80000,
          originalPrice: 100000,
          stock: 10,
          productUrl: "/p",
          checkoutUrl: "/c",
        },
      ];
      const result = formatProducts(products);
      expect(result).toContain("giảm 20%");
    });

    it("should show similarity score", () => {
      const products = [
        {
          name: "Item",
          price: 50000,
          score: 0.85,
          stock: 5,
          productUrl: "/p",
          checkoutUrl: "/c",
        },
      ];
      const result = formatProducts(products);
      expect(result).toContain("[Độ phù hợp: 85%]");
    });

    it("should format categories", () => {
      const items = [{ name: "Áo", slug: "ao", url: "/categories/ao" }];
      const result = formatProducts(items);
      expect(result).toBe("- Áo: /categories/ao");
    });

    it("should default brand to N/A", () => {
      const products = [
        {
          name: "No Brand",
          price: 10000,
          stock: 1,
          productUrl: "/p",
          checkoutUrl: "/c",
        },
      ];
      const result = formatProducts(products);
      expect(result).toContain("Thương hiệu: N/A");
    });
  });

  describe("buildContextMessage()", () => {
    it("should include product data when products exist", () => {
      const products = [
        {
          name: "Test",
          price: 50000,
          stock: 1,
          productUrl: "/p",
          checkoutUrl: "/c",
        },
      ];
      const msg = buildContextMessage("tìm áo", products);
      expect(msg).toContain("[KHÁCH HỎI]: tìm áo");
      expect(msg).toContain("[DỮ LIỆU SẢN PHẨM THỰC TẾ");
      expect(msg).toContain("Test");
    });

    it("should show not-found message when no products", () => {
      const msg = buildContextMessage("tìm abc", []);
      expect(msg).toContain("[KHÁCH HỎI]: tìm abc");
      expect(msg).toContain("Không tìm thấy sản phẩm phù hợp");
    });

    it("should show not-found message for null products", () => {
      const msg = buildContextMessage("hello", null);
      expect(msg).toContain("Không tìm thấy sản phẩm phù hợp");
    });
  });

  describe("validateResponse()", () => {
    it("should pass through normal response with products", () => {
      const response = "Đây là sản phẩm bạn cần";
      expect(validateResponse(response, [{ name: "Test" }])).toBe(response);
    });

    it("should pass through response without prices and no products", () => {
      const response = "Xin chào, tôi có thể giúp gì?";
      expect(validateResponse(response, [])).toBe(response);
    });

    it("should detect hallucination when prices found without products", () => {
      const response = "Sản phẩm áo thun giá 150,000đ rất đẹp";
      const result = validateResponse(response, []);
      expect(result).toContain("Em xin lỗi");
      expect(result).not.toBe(response);
    });

    it("should detect price pattern with dots", () => {
      const response = "Giá chỉ 99.000đ";
      const result = validateResponse(response, null);
      expect(result).toContain("Em xin lỗi");
    });

    it("should not flag response when products exist", () => {
      const response = "Sản phẩm giá 100,000đ";
      const result = validateResponse(response, [{ name: "Test" }]);
      expect(result).toBe(response);
    });
  });

  describe("Intent Detection Keywords", () => {
    const greetingKeywords = ["xin chào", "hello", "hi", "chào", "hey"];
    const saleKeywords = [
      "giảm giá",
      "sale",
      "khuyến mãi",
      "discount",
      "rẻ",
      "ưu đãi",
    ];
    const newKeywords = ["mới", "new", "vừa về", "mới nhất", "latest"];

    const detectIntent = (message) => {
      const lower = message.toLowerCase();
      if (greetingKeywords.some((k) => lower.includes(k))) return "greeting";
      if (saleKeywords.some((k) => lower.includes(k))) return "sale";
      if (newKeywords.some((k) => lower.includes(k))) return "new";
      return "search";
    };

    it("should detect greeting", () => {
      expect(detectIntent("Xin chào shop")).toBe("greeting");
      expect(detectIntent("Hello")).toBe("greeting");
      expect(detectIntent("hi bạn")).toBe("greeting");
    });

    it("should detect sale intent", () => {
      expect(detectIntent("có sản phẩm giảm giá không")).toBe("sale");
      expect(detectIntent("show me sale items")).toBe("sale");
    });

    it("should detect new arrivals intent", () => {
      expect(detectIntent("hàng mới về")).toBe("new");
      expect(detectIntent("latest products")).toBe("new");
    });

    it("should default to search", () => {
      expect(detectIntent("tìm áo khoác da")).toBe("search");
    });
  });
});
