/**
 * Unit Tests: Token Service
 * Tests JWT token generation and verification
 */
import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

describe("TokenService Logic", () => {
  describe("Access Token", () => {
    it("should generate a valid JWT access token", () => {
      const payload = {
        userId: "user123",
        email: "test@test.com",
        role: "user",
      };
      const token = jwt.sign(payload, ACCESS_SECRET, { expiresIn: "30m" });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should contain user data in token payload", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@test.com",
        role: "user",
        permissions: ["product:read"],
      };
      const token = jwt.sign(payload, ACCESS_SECRET, { expiresIn: "30m" });
      const decoded = jwt.verify(token, ACCESS_SECRET);

      expect(decoded.userId).toBe("user123");
      expect(decoded.username).toBe("testuser");
      expect(decoded.email).toBe("test@test.com");
      expect(decoded.role).toBe("user");
      expect(decoded.permissions).toContain("product:read");
    });

    it("should reject token with wrong secret", () => {
      const token = jwt.sign({ userId: "123" }, ACCESS_SECRET, {
        expiresIn: "30m",
      });

      expect(() => jwt.verify(token, "wrong-secret")).toThrow();
    });

    it("should reject expired token", () => {
      const token = jwt.sign({ userId: "123" }, ACCESS_SECRET, {
        expiresIn: "0s",
      });

      // Small delay to ensure expiration
      expect(() => jwt.verify(token, ACCESS_SECRET)).toThrow();
    });
  });

  describe("Refresh Token", () => {
    it("should generate refresh token with userId", () => {
      const token = jwt.sign({ userId: "user123" }, REFRESH_SECRET, {
        expiresIn: "16d",
      });
      const decoded = jwt.verify(token, REFRESH_SECRET);

      expect(decoded.userId).toBe("user123");
    });

    it("should use different secret than access token", () => {
      const accessToken = jwt.sign({ userId: "123" }, ACCESS_SECRET);
      const refreshToken = jwt.sign({ userId: "123" }, REFRESH_SECRET);

      // Verifying with wrong secret should fail
      expect(() => jwt.verify(accessToken, REFRESH_SECRET)).toThrow();
      expect(() => jwt.verify(refreshToken, ACCESS_SECRET)).toThrow();
    });
  });

  describe("Token Payload Structure", () => {
    it("should build correct payload with permissions", () => {
      const user = {
        _id: "uid1",
        username: "admin",
        email: "admin@test.com",
        roles: "admin",
      };
      const permissions = ["product:create", "product:update", "user:delete"];

      const payload = {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.roles,
        permissions,
      };

      expect(payload.userId).toBe("uid1");
      expect(payload.role).toBe("admin");
      expect(payload.permissions).toHaveLength(3);
    });
  });
});
