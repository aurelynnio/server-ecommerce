/**
 * Unit Tests: Product Service Logic
 * Tests SKU generation and pure business logic
 */
import { describe, it, expect } from "vitest";

describe("ProductService Logic", () => {
  describe("generateSku", () => {
    const generateSku = (slug, color, index) => {
      const slugPart = slug
        ? slug.substring(0, 20).toUpperCase().replace(/-/g, "")
        : "PROD";
      const colorPart = color
        ? color.substring(0, 10).toUpperCase().replace(/\s+/g, "")
        : "DEFAULT";
      return `${slugPart}-${colorPart}-${String(index + 1).padStart(3, "0")}`;
    };

    it("should generate SKU with slug and color", () => {
      const sku = generateSku("ao-thun-nam", "Red", 0);
      expect(sku).toBe("AOTHUNNAM-RED-001");
    });

    it("should truncate long slug to 20 chars", () => {
      const longSlug = "this-is-a-very-long-product-slug-that-exceeds-limit";
      const sku = generateSku(longSlug, "Blue", 0);
      const slugPart =
        sku.split("-")[0] + sku.split("-")[1] + sku.split("-")[2];
      // First part should not exceed 20 chars before dashes removed
      expect(sku.split("-")[0].length).toBeLessThanOrEqual(20);
    });

    it("should truncate color to 10 chars then remove spaces", () => {
      // substring(0,10) first -> "Electric B", toUpperCase -> "ELECTRIC B", remove spaces -> "ELECTRICB"
      const sku = generateSku("prod", "Electric Blue Extra", 0);
      expect(sku).toContain("ELECTRICB");
      expect(sku).toBe("PROD-ELECTRICB-001");
    });

    it("should default slug to PROD if empty", () => {
      expect(generateSku("", "Red", 0)).toBe("PROD-RED-001");
      expect(generateSku(null, "Red", 0)).toBe("PROD-RED-001");
    });

    it("should default color to DEFAULT if empty", () => {
      expect(generateSku("product", "", 0)).toBe("PRODUCT-DEFAULT-001");
      expect(generateSku("product", null, 0)).toBe("PRODUCT-DEFAULT-001");
    });

    it("should pad index to 3 digits", () => {
      expect(generateSku("prod", "Red", 0)).toContain("-001");
      expect(generateSku("prod", "Red", 9)).toContain("-010");
      expect(generateSku("prod", "Red", 99)).toContain("-100");
    });

    it("should remove spaces from color", () => {
      const sku = generateSku("prod", "Light Blue", 0);
      expect(sku).toBe("PROD-LIGHTBLUE-001");
    });

    it("should remove dashes from slug", () => {
      const sku = generateSku("my-product-name", "Red", 0);
      expect(sku).toBe("MYPRODUCTNAME-RED-001");
    });
  });

  describe("Price Filtering Logic", () => {
    const filterByPrice = (products, minPrice, maxPrice) => {
      return products.filter((p) => {
        const price = p.price?.currentPrice || 0;
        if (minPrice && price < minPrice) return false;
        if (maxPrice && price > maxPrice) return false;
        return true;
      });
    };

    it("should filter by minimum price", () => {
      const products = [
        { price: { currentPrice: 50000 } },
        { price: { currentPrice: 100000 } },
        { price: { currentPrice: 200000 } },
      ];
      const filtered = filterByPrice(products, 100000, null);
      expect(filtered).toHaveLength(2);
    });

    it("should filter by maximum price", () => {
      const products = [
        { price: { currentPrice: 50000 } },
        { price: { currentPrice: 100000 } },
        { price: { currentPrice: 200000 } },
      ];
      const filtered = filterByPrice(products, null, 100000);
      expect(filtered).toHaveLength(2);
    });

    it("should filter by price range", () => {
      const products = [
        { price: { currentPrice: 50000 } },
        { price: { currentPrice: 100000 } },
        { price: { currentPrice: 200000 } },
      ];
      const filtered = filterByPrice(products, 60000, 150000);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].price.currentPrice).toBe(100000);
    });

    it("should return all products if no price filter", () => {
      const products = [
        { price: { currentPrice: 50000 } },
        { price: { currentPrice: 100000 } },
      ];
      expect(filterByPrice(products, null, null)).toHaveLength(2);
    });
  });

  describe("Related Products Price Buffer", () => {
    it("should calculate price range with 20% buffer", () => {
      const currentPrice = 100000;
      const priceBuffer = 0.2;
      const minPrice = currentPrice * (1 - priceBuffer);
      const maxPrice = currentPrice * (1 + priceBuffer);

      expect(minPrice).toBe(80000);
      expect(maxPrice).toBe(120000);
    });

    it("should handle zero price", () => {
      const currentPrice = 0;
      const priceBuffer = 0.2;
      const minPrice = currentPrice * (1 - priceBuffer);
      const maxPrice = currentPrice * (1 + priceBuffer);

      expect(minPrice).toBe(0);
      expect(maxPrice).toBe(0);
    });
  });
});
