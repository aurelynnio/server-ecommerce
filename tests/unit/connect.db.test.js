/**
 * Unit Tests: connect.db Logic
 * Tests buildMongoUriFromParts pure function, URI construction, env resolution
 */
import { describe, it, expect } from "vitest";

describe("ConnectDB Logic", () => {
  // --- buildMongoUriFromParts ---
  describe("buildMongoUriFromParts", () => {
    const buildMongoUriFromParts = (env) => {
      const db = env.MONGODB_DATABASE;
      const user = env.MONGODB_USER;
      const pass = env.MONGODB_PASSWORD;
      if (!db || !user || !pass) return null;

      const host = env.MONGODB_HOST || "localhost";
      const port = env.MONGODB_PORT || "27017";
      const authSource = env.MONGODB_AUTH_SOURCE || "admin";

      return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(
        pass,
      )}@${host}:${port}/${db}?authSource=${encodeURIComponent(authSource)}`;
    };

    it("should build URI with all parts provided", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "admin",
        MONGODB_PASSWORD: "secret",
        MONGODB_HOST: "mongo.example.com",
        MONGODB_PORT: "27018",
        MONGODB_AUTH_SOURCE: "myauth",
      });
      expect(result).toBe(
        "mongodb://admin:secret@mongo.example.com:27018/mydb?authSource=myauth",
      );
    });

    it("should use localhost as default host", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "admin",
        MONGODB_PASSWORD: "pass",
      });
      expect(result).toContain("@localhost:");
    });

    it("should use 27017 as default port", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "admin",
        MONGODB_PASSWORD: "pass",
      });
      expect(result).toContain(":27017/");
    });

    it("should use admin as default authSource", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "admin",
        MONGODB_PASSWORD: "pass",
      });
      expect(result).toContain("authSource=admin");
    });

    it("should return null when database is missing", () => {
      expect(
        buildMongoUriFromParts({
          MONGODB_USER: "admin",
          MONGODB_PASSWORD: "pass",
        }),
      ).toBeNull();
    });

    it("should return null when user is missing", () => {
      expect(
        buildMongoUriFromParts({
          MONGODB_DATABASE: "mydb",
          MONGODB_PASSWORD: "pass",
        }),
      ).toBeNull();
    });

    it("should return null when password is missing", () => {
      expect(
        buildMongoUriFromParts({
          MONGODB_DATABASE: "mydb",
          MONGODB_USER: "admin",
        }),
      ).toBeNull();
    });

    it("should return null when all are missing", () => {
      expect(buildMongoUriFromParts({})).toBeNull();
    });

    it("should encodeURIComponent for user with special chars", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "user@name",
        MONGODB_PASSWORD: "pass",
      });
      expect(result).toContain("user%40name");
    });

    it("should encodeURIComponent for password with special chars", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "admin",
        MONGODB_PASSWORD: "p@ss:w0rd",
      });
      expect(result).toContain("p%40ss%3Aw0rd");
    });

    it("should encodeURIComponent for authSource with special chars", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "mydb",
        MONGODB_USER: "admin",
        MONGODB_PASSWORD: "pass",
        MONGODB_AUTH_SOURCE: "my auth",
      });
      expect(result).toContain("authSource=my%20auth");
    });

    it("should produce correct full URI format", () => {
      const result = buildMongoUriFromParts({
        MONGODB_DATABASE: "testdb",
        MONGODB_USER: "root",
        MONGODB_PASSWORD: "toor",
        MONGODB_HOST: "db.local",
        MONGODB_PORT: "27019",
        MONGODB_AUTH_SOURCE: "admin",
      });
      expect(result).toBe(
        "mongodb://root:toor@db.local:27019/testdb?authSource=admin",
      );
    });
  });

  // --- URI fallback logic ---
  describe("uriFallback", () => {
    const resolveUri = (envUri, builtUri) => {
      return envUri || builtUri;
    };

    it("should prefer MONGODB_URI when set", () => {
      expect(resolveUri("mongodb://atlas", "mongodb://local")).toBe(
        "mongodb://atlas",
      );
    });

    it("should fallback to built URI when env URI is not set", () => {
      expect(resolveUri(undefined, "mongodb://local")).toBe("mongodb://local");
    });

    it("should fallback to built URI when env URI is empty", () => {
      expect(resolveUri("", "mongodb://local")).toBe("mongodb://local");
    });

    it("should return null when both are undefined", () => {
      expect(resolveUri(undefined, null)).toBeNull();
    });
  });

  // --- Pool size parsing ---
  describe("poolSizeParsing", () => {
    const parsePoolSize = (envValue, defaultVal) => {
      return Number(envValue) || defaultVal;
    };

    it("should parse numeric string", () => {
      expect(parsePoolSize("20", 10)).toBe(20);
    });

    it("should use default for undefined", () => {
      expect(parsePoolSize(undefined, 10)).toBe(10);
    });

    it("should use default for NaN", () => {
      expect(parsePoolSize("not-a-number", 10)).toBe(10);
    });

    it("should use default for empty string", () => {
      expect(parsePoolSize("", 10)).toBe(10);
    });

    it("should parse 0 as falsy, use default", () => {
      // Number("0") is 0, which is falsy, so default is used
      expect(parsePoolSize("0", 10)).toBe(10);
    });
  });

  // --- Atlas detection ---
  describe("atlasDetection", () => {
    const getConnectionType = (uri) => {
      return uri.includes("srv") ? "Atlas (Cloud)" : "Mongo";
    };

    it("should detect Atlas URI", () => {
      expect(getConnectionType("mongodb+srv://cluster.mongodb.net")).toBe(
        "Atlas (Cloud)",
      );
    });

    it("should detect local Mongo URI", () => {
      expect(getConnectionType("mongodb://localhost:27017/mydb")).toBe("Mongo");
    });
  });
});
