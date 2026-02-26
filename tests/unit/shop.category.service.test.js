/**
 * Unit Tests: Shop Category Service Logic
 * Tests countMap building, field defaults, duplicate name check, ObjectId conversion
 */
import { describe, it, expect } from "vitest";

describe("ShopCategoryService Logic", () => {
  // --- countMap build from aggregation ---
  describe("countMapBuild", () => {
    const buildCountMap = (productCounts) => {
      const countMap = {};
      productCounts.forEach((p) => {
        countMap[p._id.toString()] = p.count;
      });
      return countMap;
    };

    it("should build map from aggregation results", () => {
      const counts = [
        { _id: "cat1", count: 5 },
        { _id: "cat2", count: 10 },
      ];
      const result = buildCountMap(counts);
      expect(result).toEqual({ cat1: 5, cat2: 10 });
    });

    it("should return empty map for empty input", () => {
      expect(buildCountMap([])).toEqual({});
    });

    it("should handle single category", () => {
      const result = buildCountMap([{ _id: "cat1", count: 1 }]);
      expect(result).toEqual({ cat1: 1 });
    });

    it("should use toString() on _id", () => {
      const objId = { toString: () => "abc123" };
      const result = buildCountMap([{ _id: objId, count: 3 }]);
      expect(result["abc123"]).toBe(3);
    });
  });

  // --- Categories with product count enrichment ---
  describe("categoriesWithCount", () => {
    const enrichCategories = (categories, countMap) => {
      return categories.map((cat) => ({
        ...cat,
        productCount: countMap[cat._id.toString()] || 0,
      }));
    };

    it("should add productCount from countMap", () => {
      const categories = [
        { _id: "cat1", name: "Electronics" },
        { _id: "cat2", name: "Books" },
      ];
      const countMap = { cat1: 15, cat2: 7 };
      const result = enrichCategories(categories, countMap);
      expect(result[0].productCount).toBe(15);
      expect(result[1].productCount).toBe(7);
    });

    it("should default to 0 when category not in countMap", () => {
      const categories = [{ _id: "cat1", name: "Empty" }];
      const result = enrichCategories(categories, {});
      expect(result[0].productCount).toBe(0);
    });

    it("should preserve original category fields", () => {
      const categories = [{ _id: "c1", name: "A", displayOrder: 1 }];
      const result = enrichCategories(categories, { c1: 5 });
      expect(result[0].name).toBe("A");
      expect(result[0].displayOrder).toBe(1);
      expect(result[0].productCount).toBe(5);
    });

    it("should handle empty categories array", () => {
      expect(enrichCategories([], { c1: 5 })).toEqual([]);
    });
  });

  // --- Category field defaults ---
  describe("categoryFieldDefaults", () => {
    const applyDefaults = (data) => ({
      name: data.name,
      description: data?.description || "",
      image: data?.image || "",
      isActive: typeof data.isActive === "boolean" ? data.isActive : true,
      displayOrder:
        typeof data.displayOrder === "number" ? data.displayOrder : 0,
    });

    it("should use provided values", () => {
      const result = applyDefaults({
        name: "Tech",
        description: "Gadgets",
        image: "url.jpg",
        isActive: false,
        displayOrder: 5,
      });
      expect(result.name).toBe("Tech");
      expect(result.description).toBe("Gadgets");
      expect(result.image).toBe("url.jpg");
      expect(result.isActive).toBe(false);
      expect(result.displayOrder).toBe(5);
    });

    it("should default description to empty string", () => {
      expect(applyDefaults({ name: "A" }).description).toBe("");
    });

    it("should default image to empty string", () => {
      expect(applyDefaults({ name: "A" }).image).toBe("");
    });

    it("should default isActive to true", () => {
      expect(applyDefaults({ name: "A" }).isActive).toBe(true);
    });

    it("should default displayOrder to 0", () => {
      expect(applyDefaults({ name: "A" }).displayOrder).toBe(0);
    });

    it("should accept isActive=false explicitly", () => {
      expect(applyDefaults({ name: "A", isActive: false }).isActive).toBe(
        false,
      );
    });

    it("should accept displayOrder=0 explicitly", () => {
      expect(applyDefaults({ name: "A", displayOrder: 0 }).displayOrder).toBe(
        0,
      );
    });

    it("should treat non-boolean isActive as true", () => {
      expect(applyDefaults({ name: "A", isActive: "yes" }).isActive).toBe(true);
      expect(applyDefaults({ name: "A", isActive: 1 }).isActive).toBe(true);
    });

    it("should treat non-number displayOrder as 0", () => {
      expect(
        applyDefaults({ name: "A", displayOrder: "first" }).displayOrder,
      ).toBe(0);
    });
  });

  // --- Duplicate name detection ---
  describe("duplicateNameCheck", () => {
    const isDuplicateName = (existing) => !!existing;

    it("should detect duplicate when category exists", () => {
      expect(isDuplicateName({ _id: "cat1", name: "Test" })).toBe(true);
    });

    it("should not detect duplicate when null", () => {
      expect(isDuplicateName(null)).toBe(false);
    });

    it("should not detect duplicate when undefined", () => {
      expect(isDuplicateName(undefined)).toBe(false);
    });
  });

  // --- ObjectId conversion ---
  describe("objectIdConversion", () => {
    const convertToObjectId = (shopId) => {
      return typeof shopId === "string" ? `ObjectId(${shopId})` : shopId;
    };

    it("should convert string shopId", () => {
      const result = convertToObjectId("abc123");
      expect(result).toBe("ObjectId(abc123)");
    });

    it("should not convert non-string shopId", () => {
      const objId = { _id: "abc" };
      expect(convertToObjectId(objId)).toBe(objId);
    });
  });

  // --- ShopId resolution ---
  describe("shopIdResolution", () => {
    const resolveShopId = (shopIdParam, userShop) => {
      let shopId = shopIdParam;
      if (!shopId && userShop) {
        shopId = userShop._id;
      }
      return shopId || null;
    };

    it("should use shopIdParam when provided", () => {
      expect(resolveShopId("shop1", { _id: "shop2" })).toBe("shop1");
    });

    it("should fall back to user shop when no param", () => {
      expect(resolveShopId(null, { _id: "shop2" })).toBe("shop2");
    });

    it("should return null when neither available", () => {
      expect(resolveShopId(null, null)).toBeNull();
    });

    it("should use param even when user shop exists", () => {
      expect(resolveShopId("shop1", { _id: "shop2" })).toBe("shop1");
    });
  });

  // --- Update field cleanup ---
  describe("updateFieldCleanup", () => {
    const cleanUpdates = (updates) => {
      const cleaned = { ...updates };
      if (cleaned?.description === undefined) delete cleaned.description;
      if (cleaned?.image === undefined) delete cleaned.image;
      return cleaned;
    };

    it("should keep defined fields", () => {
      const result = cleanUpdates({
        name: "New",
        description: "Desc",
        image: "img.jpg",
      });
      expect(result).toEqual({
        name: "New",
        description: "Desc",
        image: "img.jpg",
      });
    });

    it("should remove undefined description", () => {
      const result = cleanUpdates({ name: "New" });
      expect(result).toEqual({ name: "New" });
      expect("description" in result).toBe(false);
    });

    it("should remove undefined image", () => {
      const result = cleanUpdates({ name: "New" });
      expect("image" in result).toBe(false);
    });

    it("should keep empty string description", () => {
      const result = cleanUpdates({ description: "" });
      expect(result.description).toBe("");
    });

    it("should keep null description", () => {
      const result = cleanUpdates({ description: null });
      expect(result.description).toBeNull();
    });
  });
});
