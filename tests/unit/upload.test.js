/**
 * Unit Tests: Upload config - isAllowedMime logic
 *
 * isAllowedMime is module-private; we re-implement the pure logic for testing
 * (same pattern as other tests in this project for modules with constructor side-effects).
 */
import { describe, it, expect } from "vitest";

/**
 * Re-implementation of isAllowedMime from src/configs/upload.js
 * Supports prefix matching (e.g., "image/" matches "image/jpeg")
 * and exact matching (e.g., "application/pdf" matches "application/pdf").
 */
function isAllowedMime(mimetype, allowedMime) {
  if (!mimetype) return false;
  return allowedMime.some((rule) =>
    rule.endsWith("/") ? mimetype.startsWith(rule) : mimetype === rule,
  );
}

describe("Upload Config – isAllowedMime", () => {
  const defaultRules = ["image/"]; // Default UPLOAD_ALLOWED_MIME

  describe("prefix matching (rule ends with /)", () => {
    it("should accept image/jpeg", () => {
      expect(isAllowedMime("image/jpeg", defaultRules)).toBe(true);
    });

    it("should accept image/png", () => {
      expect(isAllowedMime("image/png", defaultRules)).toBe(true);
    });

    it("should accept image/webp", () => {
      expect(isAllowedMime("image/webp", defaultRules)).toBe(true);
    });

    it("should accept image/gif", () => {
      expect(isAllowedMime("image/gif", defaultRules)).toBe(true);
    });

    it("should reject application/pdf", () => {
      expect(isAllowedMime("application/pdf", defaultRules)).toBe(false);
    });

    it("should reject text/plain", () => {
      expect(isAllowedMime("text/plain", defaultRules)).toBe(false);
    });

    it("should reject video/mp4", () => {
      expect(isAllowedMime("video/mp4", defaultRules)).toBe(false);
    });
  });

  describe("exact matching", () => {
    const rules = ["application/pdf", "image/"];

    it("should accept exact match application/pdf", () => {
      expect(isAllowedMime("application/pdf", rules)).toBe(true);
    });

    it("should still accept prefix match image/png", () => {
      expect(isAllowedMime("image/png", rules)).toBe(true);
    });

    it("should reject application/json (not in rules)", () => {
      expect(isAllowedMime("application/json", rules)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for null mimetype", () => {
      expect(isAllowedMime(null, defaultRules)).toBe(false);
    });

    it("should return false for undefined mimetype", () => {
      expect(isAllowedMime(undefined, defaultRules)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isAllowedMime("", defaultRules)).toBe(false);
    });

    it("should return false when no rules match", () => {
      expect(isAllowedMime("audio/mp3", ["video/"])).toBe(false);
    });

    it("should handle multiple prefix rules", () => {
      const multi = ["image/", "video/"];
      expect(isAllowedMime("image/png", multi)).toBe(true);
      expect(isAllowedMime("video/mp4", multi)).toBe(true);
      expect(isAllowedMime("audio/mp3", multi)).toBe(false);
    });
  });
});
