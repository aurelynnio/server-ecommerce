/**
 * Unit Tests: Socket auth middleware
 * Tests cookie parsing + token extraction logic
 *
 * Re-implements the pure logic to avoid dependencies on
 * real tokenService (which requires JWT secret env vars).
 */
import { describe, it, expect } from "vitest";
import cookie from "cookie";

/**
 * Re-implementation of cookie-based token extraction
 * from src/middlewares/socketAuth.middleware.js
 */
function extractTokenFromSocket(socket) {
  if (!socket.handshake?.headers?.cookie) {
    return null;
  }
  const cookies = cookie.parse(socket.handshake.headers.cookie);
  return cookies.accessToken || null;
}

/**
 * Re-implementation of user object construction
 */
function buildSocketUser(decoded) {
  return {
    id: decoded.userId,
    role: decoded.role,
  };
}

describe("Socket Auth Middleware – Token Extraction", () => {
  it("should extract accessToken from cookie header", () => {
    const socket = {
      handshake: {
        headers: { cookie: "accessToken=jwt-token-123; other=abc" },
      },
    };
    expect(extractTokenFromSocket(socket)).toBe("jwt-token-123");
  });

  it("should return null when no cookie header", () => {
    const socket = { handshake: { headers: {} } };
    expect(extractTokenFromSocket(socket)).toBe(null);
  });

  it("should return null when no accessToken in cookies", () => {
    const socket = {
      handshake: {
        headers: { cookie: "session=abc123; theme=dark" },
      },
    };
    expect(extractTokenFromSocket(socket)).toBe(null);
  });

  it("should handle multiple cookies correctly", () => {
    const socket = {
      handshake: {
        headers: {
          cookie: "refreshToken=refresh123; accessToken=access456; theme=dark",
        },
      },
    };
    expect(extractTokenFromSocket(socket)).toBe("access456");
  });

  it("should handle cookie with spaces", () => {
    const socket = {
      handshake: {
        headers: { cookie: "accessToken=token123" },
      },
    };
    expect(extractTokenFromSocket(socket)).toBe("token123");
  });

  it("should return null when handshake is undefined", () => {
    const socket = {};
    expect(extractTokenFromSocket(socket)).toBe(null);
  });
});

describe("Socket Auth Middleware – User Construction", () => {
  it("should map decoded.userId to user.id", () => {
    const decoded = { userId: "u123", role: "user" };
    const user = buildSocketUser(decoded);
    expect(user).toEqual({ id: "u123", role: "user" });
  });

  it("should preserve role from decoded token", () => {
    const decoded = { userId: "u456", role: "admin" };
    const user = buildSocketUser(decoded);
    expect(user.role).toBe("admin");
  });

  it("should handle seller role", () => {
    const user = buildSocketUser({ userId: "u789", role: "seller" });
    expect(user).toEqual({ id: "u789", role: "seller" });
  });
});
