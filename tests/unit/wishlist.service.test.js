/**
 * Unit Tests: Wishlist Service Logic
 * Tests image mapping, batch check with Set, product status validation
 */
import { describe, it, expect } from "vitest";

describe("WishlistService Logic", () => {
  // --- Product image mapping ---
  describe("wishlistImageMapping", () => {
    const mapWishlistProducts = (products) => {
      return products.map((product) => ({
        ...product,
        image: product.variants?.[0]?.images?.[0] || null,
      }));
    };

    it("should extract first variant image", () => {
      const products = [
        { name: "A", variants: [{ images: ["img1.jpg", "img2.jpg"] }] },
      ];
      const result = mapWishlistProducts(products);
      expect(result[0].image).toBe("img1.jpg");
    });

    it("should return null when no variants", () => {
      const products = [{ name: "A", variants: [] }];
      const result = mapWishlistProducts(products);
      expect(result[0].image).toBeNull();
    });

    it("should return null when variant has no images", () => {
      const products = [{ name: "A", variants: [{ images: [] }] }];
      const result = mapWishlistProducts(products);
      expect(result[0].image).toBeNull();
    });

    it("should return null when no variants field", () => {
      const products = [{ name: "A" }];
      const result = mapWishlistProducts(products);
      expect(result[0].image).toBeNull();
    });

    it("should preserve other product fields", () => {
      const products = [
        {
          name: "A",
          slug: "a",
          price: { currentPrice: 100 },
          variants: [{ images: ["img.jpg"] }],
        },
      ];
      const result = mapWishlistProducts(products);
      expect(result[0].name).toBe("A");
      expect(result[0].slug).toBe("a");
      expect(result[0].price).toEqual({ currentPrice: 100 });
    });
  });

  // --- checkMultipleInWishlist: Set-based lookup ---
  describe("checkMultipleInWishlist", () => {
    const checkMultiple = (entries, requestedIds) => {
      const wishlistSet = new Set(entries.map((e) => e.productId.toString()));
      const result = {};
      requestedIds.forEach((id) => {
        result[id] = wishlistSet.has(id.toString());
      });
      return result;
    };

    it("should mark existing products as true", () => {
      const entries = [{ productId: "p1" }, { productId: "p3" }];
      const result = checkMultiple(entries, ["p1", "p2", "p3"]);
      expect(result).toEqual({ p1: true, p2: false, p3: true });
    });

    it("should mark all as false when wishlist is empty", () => {
      const result = checkMultiple([], ["p1", "p2"]);
      expect(result).toEqual({ p1: false, p2: false });
    });

    it("should handle single product check", () => {
      const entries = [{ productId: "p1" }];
      const result = checkMultiple(entries, ["p1"]);
      expect(result).toEqual({ p1: true });
    });

    it("should handle empty check list", () => {
      const result = checkMultiple([{ productId: "p1" }], []);
      expect(result).toEqual({});
    });
  });

  // --- Product status validation for add ---
  describe("productStatusValidation", () => {
    const canAddToWishlist = (product) => {
      if (!product) return { ok: false, reason: "not_found" };
      if (product.status !== "published")
        return { ok: false, reason: "not_available" };
      return { ok: true };
    };

    it("should allow published product", () => {
      expect(canAddToWishlist({ status: "published" })).toEqual({ ok: true });
    });

    it("should reject draft product", () => {
      expect(canAddToWishlist({ status: "draft" })).toEqual({
        ok: false,
        reason: "not_available",
      });
    });

    it("should reject archived product", () => {
      expect(canAddToWishlist({ status: "archived" })).toEqual({
        ok: false,
        reason: "not_available",
      });
    });

    it("should reject null product", () => {
      expect(canAddToWishlist(null)).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("should reject undefined product", () => {
      expect(canAddToWishlist(undefined)).toEqual({
        ok: false,
        reason: "not_found",
      });
    });
  });

  // --- Duplicate check ---
  describe("duplicateCheck", () => {
    const isDuplicate = (entries, userId, productId) => {
      return entries.some(
        (e) => e.userId === userId && e.productId === productId,
      );
    };

    it("should detect duplicate", () => {
      const entries = [{ userId: "u1", productId: "p1" }];
      expect(isDuplicate(entries, "u1", "p1")).toBe(true);
    });

    it("should not flag different product", () => {
      const entries = [{ userId: "u1", productId: "p1" }];
      expect(isDuplicate(entries, "u1", "p2")).toBe(false);
    });

    it("should not flag different user", () => {
      const entries = [{ userId: "u1", productId: "p1" }];
      expect(isDuplicate(entries, "u2", "p1")).toBe(false);
    });
  });
});
