/**
 * Unit Tests: User Service Logic
 * Tests regex escape, search length limit, address management, duplicate checks, profile updates
 */
import { describe, it, expect } from "vitest";

describe("UserService Logic", () => {
  // --- Regex escape for search ---
  describe("escapeRegex", () => {
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    it("should escape dots", () => {
      expect(escapeRegex("test.value")).toBe("test\\.value");
    });

    it("should escape asterisks", () => {
      expect(escapeRegex("test*")).toBe("test\\*");
    });

    it("should escape question marks", () => {
      expect(escapeRegex("what?")).toBe("what\\?");
    });

    it("should escape parentheses", () => {
      expect(escapeRegex("(group)")).toBe("\\(group\\)");
    });

    it("should escape square brackets", () => {
      expect(escapeRegex("[abc]")).toBe("\\[abc\\]");
    });

    it("should escape curly braces", () => {
      expect(escapeRegex("{n}")).toBe("\\{n\\}");
    });

    it("should escape pipe", () => {
      expect(escapeRegex("a|b")).toBe("a\\|b");
    });

    it("should escape backslash", () => {
      expect(escapeRegex("path\\to")).toBe("path\\\\to");
    });

    it("should escape caret and dollar", () => {
      expect(escapeRegex("^start$end")).toBe("\\^start\\$end");
    });

    it("should escape plus", () => {
      expect(escapeRegex("a+b")).toBe("a\\+b");
    });

    it("should handle multiple special chars together", () => {
      expect(escapeRegex("a.*b+c?d")).toBe("a\\.\\*b\\+c\\?d");
    });

    it("should leave normal strings unchanged", () => {
      expect(escapeRegex("hello world")).toBe("hello world");
    });

    it("should handle empty string", () => {
      expect(escapeRegex("")).toBe("");
    });
  });

  // --- Search length limit ---
  describe("searchLengthLimit", () => {
    const MAX_SEARCH_LENGTH = 100;

    const applySearchLimit = (search) => {
      if (!search) return null;
      const trimmed = search.trim();
      if (trimmed.length > MAX_SEARCH_LENGTH) return null;
      return trimmed;
    };

    it("should accept normal length search", () => {
      expect(applySearchLimit("laptop")).toBe("laptop");
    });

    it("should trim whitespace", () => {
      expect(applySearchLimit("  laptop  ")).toBe("laptop");
    });

    it("should reject search over 100 chars", () => {
      const longSearch = "a".repeat(101);
      expect(applySearchLimit(longSearch)).toBeNull();
    });

    it("should accept exactly 100 chars", () => {
      const exact = "a".repeat(100);
      expect(applySearchLimit(exact)).toBe(exact);
    });

    it("should handle empty string", () => {
      expect(applySearchLimit("")).toBeNull();
    });

    it("should handle null", () => {
      expect(applySearchLimit(null)).toBeNull();
    });

    it("should handle undefined", () => {
      expect(applySearchLimit(undefined)).toBeNull();
    });
  });

  // --- Set default address logic ---
  describe("setDefaultAddress", () => {
    const setDefault = (addresses, targetId) => {
      return addresses.map((addr) => ({
        ...addr,
        isDefault: addr._id === targetId,
      }));
    };

    it("should set only the target address as default", () => {
      const addresses = [
        { _id: "a1", isDefault: true, street: "Street 1" },
        { _id: "a2", isDefault: false, street: "Street 2" },
        { _id: "a3", isDefault: false, street: "Street 3" },
      ];
      const result = setDefault(addresses, "a2");
      expect(result[0].isDefault).toBe(false);
      expect(result[1].isDefault).toBe(true);
      expect(result[2].isDefault).toBe(false);
    });

    it("should reset all when setting a new default", () => {
      const addresses = [
        { _id: "a1", isDefault: true },
        { _id: "a2", isDefault: true },
      ];
      const result = setDefault(addresses, "a1");
      expect(result[0].isDefault).toBe(true);
      expect(result[1].isDefault).toBe(false);
    });

    it("should handle single address", () => {
      const result = setDefault([{ _id: "a1", isDefault: false }], "a1");
      expect(result[0].isDefault).toBe(true);
    });

    it("should handle non-existent target (all become false)", () => {
      const addresses = [
        { _id: "a1", isDefault: true },
        { _id: "a2", isDefault: false },
      ];
      const result = setDefault(addresses, "nonexistent");
      expect(result.every((a) => a.isDefault === false)).toBe(true);
    });
  });

  // --- Duplicate check logic ---
  describe("duplicateCheck", () => {
    const checkDuplicate = (users, field, value, excludeId = null) => {
      return users.some((u) => u[field] === value && u._id !== excludeId);
    };

    it("should detect duplicate username", () => {
      const users = [{ _id: "1", username: "john", email: "john@example.com" }];
      expect(checkDuplicate(users, "username", "john")).toBe(true);
    });

    it("should detect duplicate email", () => {
      const users = [{ _id: "1", username: "john", email: "john@example.com" }];
      expect(checkDuplicate(users, "email", "john@example.com")).toBe(true);
    });

    it("should not report self as duplicate when excludeId provided", () => {
      const users = [{ _id: "1", username: "john", email: "john@example.com" }];
      expect(checkDuplicate(users, "username", "john", "1")).toBe(false);
    });

    it("should flag another user with same value even with excludeId", () => {
      const users = [
        { _id: "1", username: "john" },
        { _id: "2", username: "john" },
      ];
      expect(checkDuplicate(users, "username", "john", "1")).toBe(true);
    });

    it("should return false for unique value", () => {
      const users = [{ _id: "1", username: "john" }];
      expect(checkDuplicate(users, "username", "jane")).toBe(false);
    });
  });

  // --- Update address partial merge ---
  describe("updateAddress", () => {
    const updateAddress = (existing, updates) => {
      const merged = { ...existing };
      if (updates.fullName !== undefined) merged.fullName = updates.fullName;
      if (updates.phone !== undefined) merged.phone = updates.phone;
      if (updates.province !== undefined) merged.province = updates.province;
      if (updates.district !== undefined) merged.district = updates.district;
      if (updates.ward !== undefined) merged.ward = updates.ward;
      if (updates.street !== undefined) merged.street = updates.street;
      if (updates.isDefault !== undefined) merged.isDefault = updates.isDefault;
      return merged;
    };

    it("should update only provided fields", () => {
      const existing = {
        fullName: "John",
        phone: "0123456789",
        province: "HN",
        district: "CG",
        ward: "W1",
        street: "St1",
        isDefault: false,
      };
      const result = updateAddress(existing, { phone: "0987654321" });
      expect(result.phone).toBe("0987654321");
      expect(result.fullName).toBe("John");
      expect(result.province).toBe("HN");
    });

    it("should not modify when updates is empty", () => {
      const existing = { fullName: "John", phone: "012" };
      const result = updateAddress(existing, {});
      expect(result).toEqual(existing);
    });

    it("should update multiple fields at once", () => {
      const existing = { fullName: "John", phone: "012", street: "St1" };
      const result = updateAddress(existing, {
        fullName: "Jane",
        street: "St2",
      });
      expect(result.fullName).toBe("Jane");
      expect(result.street).toBe("St2");
      expect(result.phone).toBe("012");
    });
  });

  // --- Strip password from user response ---
  describe("stripPassword", () => {
    const stripPassword = (user) => {
      const { password, ...rest } = user;
      return rest;
    };

    it("should remove password field", () => {
      const user = { _id: "1", username: "john", password: "hashed123" };
      const result = stripPassword(user);
      expect(result).toEqual({ _id: "1", username: "john" });
      expect(result.password).toBeUndefined();
    });

    it("should work when no password field", () => {
      const user = { _id: "1", username: "john" };
      const result = stripPassword(user);
      expect(result).toEqual({ _id: "1", username: "john" });
    });
  });

  // --- Build search filter ---
  describe("buildSearchFilter", () => {
    const buildFilter = ({ search, role, isVerifiedEmail }) => {
      const filter = {};

      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        filter.$or = [
          { username: { $regex: regex } },
          { email: { $regex: regex } },
        ];
      }

      if (role) filter.roles = role;
      if (isVerifiedEmail !== undefined)
        filter.isVerifiedEmail = isVerifiedEmail === "true";

      return filter;
    };

    it("should build regex filter for search", () => {
      const filter = buildFilter({ search: "john" });
      expect(filter.$or).toHaveLength(2);
      expect(filter.$or[0].username.$regex).toBeInstanceOf(RegExp);
    });

    it("should escape special chars in search", () => {
      const filter = buildFilter({ search: "user.*" });
      const regex = filter.$or[0].username.$regex;
      expect(regex.test("user.*")).toBe(true);
      expect(regex.test("userXX")).toBe(false);
    });

    it("should add role filter", () => {
      const filter = buildFilter({ role: "admin" });
      expect(filter.roles).toBe("admin");
    });

    it("should parse isVerifiedEmail as boolean", () => {
      expect(buildFilter({ isVerifiedEmail: "true" }).isVerifiedEmail).toBe(
        true,
      );
      expect(buildFilter({ isVerifiedEmail: "false" }).isVerifiedEmail).toBe(
        false,
      );
    });

    it("should combine all filters", () => {
      const filter = buildFilter({
        search: "jo",
        role: "user",
        isVerifiedEmail: "true",
      });
      expect(filter.$or).toBeDefined();
      expect(filter.roles).toBe("user");
      expect(filter.isVerifiedEmail).toBe(true);
    });

    it("should return empty filter when no params", () => {
      const filter = buildFilter({});
      expect(filter).toEqual({});
    });
  });
});
