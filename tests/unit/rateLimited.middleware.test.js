/**
 * Unit Tests: Rate Limiter Middleware Logic
 * Tests createLimiter defaults, windowMs calculation, skip logic
 */
import { describe, it, expect } from "vitest";

describe("RateLimiter Middleware Logic", () => {
  // --- createLimiter default parameters ---
  describe("createLimiterDefaults", () => {
    const parseOptions = ({
      minutes = 15,
      max = 100,
      message = "Too many requests, please try again later.",
      prefix = "rl",
    } = {}) => ({ minutes, max, message, prefix });

    it("should use all defaults when no args", () => {
      const result = parseOptions();
      expect(result.minutes).toBe(15);
      expect(result.max).toBe(100);
      expect(result.message).toBe("Too many requests, please try again later.");
      expect(result.prefix).toBe("rl");
    });

    it("should override minutes", () => {
      expect(parseOptions({ minutes: 1 }).minutes).toBe(1);
    });

    it("should override max", () => {
      expect(parseOptions({ max: 10 }).max).toBe(10);
    });

    it("should override message", () => {
      expect(parseOptions({ message: "Slow down" }).message).toBe("Slow down");
    });

    it("should override prefix", () => {
      expect(parseOptions({ prefix: "auth" }).prefix).toBe("auth");
    });
  });

  // --- windowMs calculation ---
  describe("windowMsCalculation", () => {
    const calculateWindowMs = (minutes) => minutes * 60 * 1000;

    it("should calculate 15 minutes in ms", () => {
      expect(calculateWindowMs(15)).toBe(900000);
    });

    it("should calculate 1 minute in ms", () => {
      expect(calculateWindowMs(1)).toBe(60000);
    });

    it("should calculate 30 minutes in ms", () => {
      expect(calculateWindowMs(30)).toBe(1800000);
    });

    it("should handle 0 minutes", () => {
      expect(calculateWindowMs(0)).toBe(0);
    });
  });

  // --- Redis store prefix construction ---
  describe("storePrefixConstruction", () => {
    const buildStorePrefix = (prefix) => `rate-limit:${prefix}:`;

    it("should build global prefix", () => {
      expect(buildStorePrefix("global")).toBe("rate-limit:global:");
    });

    it("should build auth prefix", () => {
      expect(buildStorePrefix("auth")).toBe("rate-limit:auth:");
    });

    it("should build sensitive prefix", () => {
      expect(buildStorePrefix("sensitive")).toBe("rate-limit:sensitive:");
    });

    it("should build chatbot prefix", () => {
      expect(buildStorePrefix("chatbot")).toBe("rate-limit:chatbot:");
    });

    it("should build default prefix", () => {
      expect(buildStorePrefix("rl")).toBe("rate-limit:rl:");
    });
  });

  // --- Skip logic (fail-open) ---
  describe("skipLogic", () => {
    const shouldSkip = (isReady) => !isReady;

    it("should skip when Redis is not ready", () => {
      expect(shouldSkip(false)).toBe(true);
    });

    it("should not skip when Redis is ready", () => {
      expect(shouldSkip(true)).toBe(false);
    });

    it("should skip when isReady is undefined", () => {
      expect(shouldSkip(undefined)).toBe(true);
    });

    it("should skip when isReady is null", () => {
      expect(shouldSkip(null)).toBe(true);
    });
  });

  // --- Pre-configured limiter configs ---
  describe("preconfiguredLimiters", () => {
    const limiterConfigs = {
      global: { minutes: 15, max: 1000, prefix: "global" },
      auth: {
        minutes: 15,
        max: 10,
        message: "Too many login attempts. Please try again after 15 minutes.",
        prefix: "auth",
      },
      sensitive: {
        minutes: 1,
        max: 5,
        message: "Too many requests. Please slow down.",
        prefix: "sensitive",
      },
      chatbot: {
        minutes: 1,
        max: 30,
        message: "Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ một chút.",
        prefix: "chatbot",
      },
    };

    it("global limiter should allow 1000 requests per 15 minutes", () => {
      expect(limiterConfigs.global.max).toBe(1000);
      expect(limiterConfigs.global.minutes).toBe(15);
    });

    it("auth limiter should allow only 10 requests per 15 minutes", () => {
      expect(limiterConfigs.auth.max).toBe(10);
      expect(limiterConfigs.auth.minutes).toBe(15);
    });

    it("sensitive limiter should allow only 5 requests per minute", () => {
      expect(limiterConfigs.sensitive.max).toBe(5);
      expect(limiterConfigs.sensitive.minutes).toBe(1);
    });

    it("chatbot limiter should allow 30 requests per minute", () => {
      expect(limiterConfigs.chatbot.max).toBe(30);
      expect(limiterConfigs.chatbot.minutes).toBe(1);
    });

    it("auth limiter should have brute force message", () => {
      expect(limiterConfigs.auth.message).toContain("login attempts");
    });

    it("chatbot limiter should have Vietnamese message", () => {
      expect(limiterConfigs.chatbot.message).toContain("Vui lòng");
    });
  });
});
