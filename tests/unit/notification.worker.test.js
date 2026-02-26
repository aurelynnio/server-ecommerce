/**
 * Unit Tests: Notification Worker Logic
 * Tests message destructuring, handler delegation
 */
import { describe, it, expect } from "vitest";

describe("NotificationWorker Logic", () => {
  // --- Message destructuring ---
  describe("messageDestructuring", () => {
    const extractNotificationData = (data) => {
      const { type, userId, title, message, orderId, link } = data;
      return { userId, type, title, message, orderId, link };
    };

    it("should extract all fields from data", () => {
      const result = extractNotificationData({
        type: "order_update",
        userId: "u1",
        title: "Order Shipped",
        message: "Your order has been shipped",
        orderId: "ord1",
        link: "/orders/ord1",
      });
      expect(result.type).toBe("order_update");
      expect(result.userId).toBe("u1");
      expect(result.title).toBe("Order Shipped");
      expect(result.message).toBe("Your order has been shipped");
      expect(result.orderId).toBe("ord1");
      expect(result.link).toBe("/orders/ord1");
    });

    it("should handle missing optional fields as undefined", () => {
      const result = extractNotificationData({
        type: "info",
        userId: "u1",
        title: "Info",
        message: "Hello",
      });
      expect(result.orderId).toBeUndefined();
      expect(result.link).toBeUndefined();
    });

    it("should handle extra fields by ignoring them", () => {
      const result = extractNotificationData({
        type: "promo",
        userId: "u1",
        title: "Sale",
        message: "50% off",
        extraField: "ignored",
      });
      expect(result).not.toHaveProperty("extraField");
    });
  });

  // --- Notification payload construction for createNotification ---
  describe("notificationPayload", () => {
    const buildNotificationPayload = (data) => ({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      orderId: data.orderId,
      link: data.link,
    });

    it("should build payload matching service signature", () => {
      const payload = buildNotificationPayload({
        type: "order_created",
        userId: "u1",
        title: "New Order",
        message: "Order created",
        orderId: "o1",
        link: "/orders/o1",
      });
      expect(payload).toEqual({
        userId: "u1",
        type: "order_created",
        title: "New Order",
        message: "Order created",
        orderId: "o1",
        link: "/orders/o1",
      });
    });
  });

  // --- Error re-throw pattern ---
  describe("errorReThrow", () => {
    const processWithRethrow = async (handler, data) => {
      try {
        await handler(data);
      } catch (error) {
        throw error;
      }
    };

    it("should propagate handler errors", async () => {
      const failingHandler = async () => {
        throw new Error("DB error");
      };
      await expect(processWithRethrow(failingHandler, {})).rejects.toThrow(
        "DB error",
      );
    });

    it("should not throw when handler succeeds", async () => {
      const okHandler = async () => ({ success: true });
      await expect(processWithRethrow(okHandler, {})).resolves.toBeUndefined();
    });
  });
});
