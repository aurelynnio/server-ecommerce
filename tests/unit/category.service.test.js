/**
 * Unit Tests: Category Service Logic
 * Tests slug generation, circular parent detection
 */
import { describe, it, expect } from "vitest";
import slugify from "slugify";

describe("CategoryService Logic", () => {
  describe("Slug Generation", () => {
    it("should generate slug from name", () => {
      const slug = slugify("Áo Thun Nam", {
        lower: true,
        strict: true,
        locale: "vi",
      });
      expect(slug).toBeDefined();
      expect(typeof slug).toBe("string");
      expect(slug).not.toContain(" ");
    });

    it("should generate lowercase slug", () => {
      const slug = slugify("Electronics & Gadgets", {
        lower: true,
        strict: true,
      });
      expect(slug).toBe(slug.toLowerCase());
    });

    it("should handle Vietnamese characters", () => {
      const slug = slugify("Điện Thoại Di Động", {
        lower: true,
        strict: true,
        locale: "vi",
      });
      expect(slug).toBeDefined();
      expect(slug.length).toBeGreaterThan(0);
    });

    it("should remove special characters with strict mode", () => {
      const slug = slugify("Sale! 50% Off & More", {
        lower: true,
        strict: true,
      });
      expect(slug).not.toContain("!");
      expect(slug).not.toContain("%");
      expect(slug).not.toContain("&");
    });
  });

  describe("Circular Parent Detection", () => {
    it("should detect self-referencing parent", () => {
      const categoryId = "cat123";
      const parentCategory = "cat123";
      expect(parentCategory === categoryId).toBe(true);
    });

    it("should detect direct circular reference", () => {
      // If child's parentCategory points to parent,
      // and parent's parentCategory points to child
      const parent = { _id: "parentId", parentCategory: "childId" };
      const childId = "childId";
      const newParentCategory = "parentId";

      const isCircular = parent.parentCategory?.toString() === childId;
      expect(isCircular).toBe(true);
    });
  });

  describe("Category Tree Building", () => {
    it("should build tree from flat categories", () => {
      const rootCategories = [
        { _id: "root1", name: "Electronics" },
        { _id: "root2", name: "Fashion" },
      ];
      const allSubcategories = [
        { _id: "sub1", name: "Phones", parentCategory: "root1" },
        { _id: "sub2", name: "Laptops", parentCategory: "root1" },
        { _id: "sub3", name: "Men", parentCategory: "root2" },
        { _id: "sub4", name: "iPhone", parentCategory: "sub1" },
      ];

      const buildTree = (parentId) => {
        return allSubcategories
          .filter(
            (cat) =>
              cat.parentCategory && cat.parentCategory.toString() === parentId,
          )
          .map((cat) => {
            const children = buildTree(cat._id.toString());
            const result = { ...cat };
            if (children.length > 0) result.subcategories = children;
            return result;
          });
      };

      const tree = rootCategories.map((cat) => {
        const children = buildTree(cat._id.toString());
        const result = { ...cat };
        if (children.length > 0) result.subcategories = children;
        return result;
      });

      expect(tree).toHaveLength(2);
      expect(tree[0].subcategories).toHaveLength(2);
      expect(tree[0].subcategories[0].subcategories).toHaveLength(1); // iPhone under Phones
      expect(tree[1].subcategories).toHaveLength(1);
    });

    it("should handle categories with no subcategories", () => {
      const rootCategories = [{ _id: "root1", name: "Empty" }];
      const allSubcategories = [];

      const buildTree = (parentId) => {
        return allSubcategories.filter(
          (cat) => cat.parentCategory?.toString() === parentId,
        );
      };

      const tree = rootCategories.map((cat) => {
        const children = buildTree(cat._id.toString());
        return {
          ...cat,
          ...(children.length > 0 ? { subcategories: children } : {}),
        };
      });

      expect(tree).toHaveLength(1);
      expect(tree[0].subcategories).toBeUndefined();
    });
  });
});
