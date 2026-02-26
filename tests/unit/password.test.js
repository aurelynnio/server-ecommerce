/**
 * Unit Tests: Password Utilities
 * Tests bcrypt hashing and comparison
 */
import { describe, it, expect } from "vitest";

const hashPassword = require("../../src/utils/hashPasword");
const comparePassword = require("../../src/utils/comparePassword");

describe("Password Utilities", () => {
  describe("hashPassword", () => {
    it("should return a hashed string different from input", async () => {
      const password = "mySecretPassword123";
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe("string");
      expect(hashed).not.toBe(password);
    });

    it("should produce different hashes for same password", async () => {
      const password = "testPassword";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
    });

    it("should produce a bcrypt hash format", async () => {
      const hashed = await hashPassword("test");
      // bcrypt hashes start with $2b$ or $2a$
      expect(hashed).toMatch(/^\$2[ab]\$/);
    });
  });

  describe("comparePassword", () => {
    it("should return true for matching password", async () => {
      const password = "correctPassword";
      const hashed = await hashPassword(password);

      const result = await comparePassword(password, hashed);
      expect(result).toBe(true);
    });

    it("should return false for non-matching password", async () => {
      const password = "correctPassword";
      const hashed = await hashPassword(password);

      const result = await comparePassword("wrongPassword", hashed);
      expect(result).toBe(false);
    });

    it("should handle empty strings", async () => {
      const hashed = await hashPassword("");
      const result = await comparePassword("", hashed);
      expect(result).toBe(true);
    });

    it("should handle special characters", async () => {
      const password = '!@#$%^&*()_+<>?:"{}|';
      const hashed = await hashPassword(password);

      expect(await comparePassword(password, hashed)).toBe(true);
      expect(await comparePassword("different", hashed)).toBe(false);
    });

    it("should handle unicode characters", async () => {
      const password = "mậtkhẩu123🔐";
      const hashed = await hashPassword(password);

      expect(await comparePassword(password, hashed)).toBe(true);
    });
  });
});
