/**
 * Unit Tests: Sanitization Utilities
 * Tests escapeHtml, sanitizeMongoOperators, sanitizeObject
 */
import { describe, it, expect } from "vitest";

const {
  escapeHtml,
  sanitizeMongoOperators,
  sanitizeObject,
} = require("../../src/validations/sanitize");

describe("Sanitize Utilities", () => {
  describe("escapeHtml()", () => {
    it("should escape & to &amp;", () => {
      expect(escapeHtml("a & b")).toBe("a &amp; b");
    });

    it("should escape < to &lt;", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("should escape > to &gt;", () => {
      expect(escapeHtml("1 > 0")).toBe("1 &gt; 0");
    });

    it('should escape " to &quot;', () => {
      expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });

    it("should escape ' to &#x27;", () => {
      expect(escapeHtml("it's")).toBe("it&#x27;s");
    });

    it("should escape all special chars in combination", () => {
      expect(escapeHtml("<img src=\"x\" onerror='alert(1)'>")).toBe(
        "&lt;img src=&quot;x&quot; onerror=&#x27;alert(1)&#x27;&gt;",
      );
    });

    it("should return non-string values unchanged", () => {
      expect(escapeHtml(123)).toBe(123);
      expect(escapeHtml(null)).toBe(null);
      expect(escapeHtml(undefined)).toBe(undefined);
    });

    it("should handle empty string", () => {
      expect(escapeHtml("")).toBe("");
    });
  });

  describe("sanitizeMongoOperators()", () => {
    it("should remove $ operator", () => {
      expect(sanitizeMongoOperators("$gt")).toBe("gt");
    });

    it("should remove . (dot) operator", () => {
      expect(sanitizeMongoOperators("nested.field")).toBe("nestedfield");
    });

    it("should remove both $ and .", () => {
      expect(sanitizeMongoOperators("$where.password")).toBe("wherepassword");
    });

    it("should return non-string values unchanged", () => {
      expect(sanitizeMongoOperators(42)).toBe(42);
      expect(sanitizeMongoOperators(null)).toBe(null);
    });

    it("should handle safe strings unchanged", () => {
      expect(sanitizeMongoOperators("hello world")).toBe("hello world");
    });
  });

  describe("sanitizeObject()", () => {
    it("should trim string values", () => {
      expect(sanitizeObject("  hello  ")).toBe("hello");
    });

    it("should trim nested object strings", () => {
      const result = sanitizeObject({ name: "  John  ", age: 25 });
      expect(result.name).toBe("John");
      expect(result.age).toBe(25);
    });

    it("should strip keys starting with $", () => {
      const result = sanitizeObject({
        name: "test",
        $gt: 100,
        $where: "1==1",
      });
      expect(result).toEqual({ name: "test" });
      expect(result).not.toHaveProperty("$gt");
      expect(result).not.toHaveProperty("$where");
    });

    it("should handle nested objects recursively", () => {
      const result = sanitizeObject({
        user: { name: "  Alice  ", $ne: null },
      });
      expect(result.user.name).toBe("Alice");
      expect(result.user).not.toHaveProperty("$ne");
    });

    it("should handle arrays", () => {
      const result = sanitizeObject(["  a  ", "  b  "]);
      expect(result).toEqual(["a", "b"]);
    });

    it("should handle null and undefined", () => {
      expect(sanitizeObject(null)).toBeNull();
      expect(sanitizeObject(undefined)).toBeUndefined();
    });

    it("should handle numbers and booleans", () => {
      expect(sanitizeObject(42)).toBe(42);
      expect(sanitizeObject(true)).toBe(true);
    });

    it("should handle deeply nested NoSQL injection", () => {
      const input = {
        query: {
          password: { $gt: "" },
          email: "test@test.com",
        },
      };
      const result = sanitizeObject(input);
      expect(result.query.email).toBe("test@test.com");
      expect(result.query).not.toHaveProperty("$gt");
    });
  });
});
