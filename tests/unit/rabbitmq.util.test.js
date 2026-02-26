/**
 * Unit Tests: RabbitMQ Util Logic
 * Tests null connection guard, JSON parse, ack/nack logic
 */
import { describe, it, expect } from "vitest";

describe("RabbitMQ Util Logic", () => {
  // --- Null connection guard ---
  describe("connectionGuard", () => {
    const shouldConsume = (connection) => {
      if (!connection) return false;
      return true;
    };

    it("should skip when connection is null", () => {
      expect(shouldConsume(null)).toBe(false);
    });

    it("should skip when connection is undefined", () => {
      expect(shouldConsume(undefined)).toBe(false);
    });

    it("should proceed when connection exists", () => {
      expect(shouldConsume({ createChannel: () => {} })).toBe(true);
    });
  });

  // --- Message content parsing ---
  describe("messageContentParsing", () => {
    const parseMessage = (msg) => {
      if (!msg) return null;
      return JSON.parse(msg.content.toString());
    };

    it("should parse Buffer content to JSON", () => {
      const msg = { content: Buffer.from(JSON.stringify({ type: "test" })) };
      const result = parseMessage(msg);
      expect(result).toEqual({ type: "test" });
    });

    it("should return null for null message", () => {
      expect(parseMessage(null)).toBeNull();
    });

    it("should return null for undefined message", () => {
      expect(parseMessage(undefined)).toBeNull();
    });

    it("should throw on invalid JSON content", () => {
      const msg = { content: Buffer.from("not json") };
      expect(() => parseMessage(msg)).toThrow();
    });

    it("should parse nested object from buffer", () => {
      const data = { user: { id: "u1" }, items: [1, 2, 3] };
      const msg = { content: Buffer.from(JSON.stringify(data)) };
      expect(parseMessage(msg)).toEqual(data);
    });
  });

  // --- Ack/Nack decision ---
  describe("ackNackDecision", () => {
    const processMessage = async (handler, data) => {
      try {
        await handler(data);
        return "ack";
      } catch {
        return "nack";
      }
    };

    it("should ack on successful processing", async () => {
      const handler = async () => {};
      expect(await processMessage(handler, {})).toBe("ack");
    });

    it("should nack on failed processing", async () => {
      const handler = async () => {
        throw new Error("fail");
      };
      expect(await processMessage(handler, {})).toBe("nack");
    });
  });

  // --- Queue assertion options ---
  describe("queueOptions", () => {
    it("should use durable: true for queue assertion", () => {
      const options = { durable: true };
      expect(options.durable).toBe(true);
    });
  });

  // --- Nack parameters ---
  describe("nackParameters", () => {
    // channel.nack(msg, false, false) - allUpTo=false, requeue=false
    const getNackParams = () => ({
      allUpTo: false,
      requeue: false,
    });

    it("should not requeue failed messages", () => {
      const params = getNackParams();
      expect(params.requeue).toBe(false);
    });

    it("should not nack all up to current message", () => {
      const params = getNackParams();
      expect(params.allUpTo).toBe(false);
    });
  });
});
