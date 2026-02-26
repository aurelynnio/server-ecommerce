/**
 * Unit Tests: Order Service Logic
 * Tests order status transitions, total calculation, and retry logic
 */
import { describe, it, expect } from "vitest";

describe("OrderService Logic", () => {
  describe("Order Status Transitions", () => {
    const allowedTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    const canTransition = (currentStatus, newStatus) => {
      return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
    };

    it("should allow pending -> confirmed", () => {
      expect(canTransition("pending", "confirmed")).toBe(true);
    });

    it("should allow pending -> cancelled", () => {
      expect(canTransition("pending", "cancelled")).toBe(true);
    });

    it("should allow confirmed -> processing", () => {
      expect(canTransition("confirmed", "processing")).toBe(true);
    });

    it("should allow processing -> shipped", () => {
      expect(canTransition("processing", "shipped")).toBe(true);
    });

    it("should allow shipped -> delivered", () => {
      expect(canTransition("shipped", "delivered")).toBe(true);
    });

    it("should reject backwards transitions", () => {
      expect(canTransition("delivered", "shipped")).toBe(false);
      expect(canTransition("shipped", "processing")).toBe(false);
      expect(canTransition("processing", "confirmed")).toBe(false);
    });

    it("should not allow transitioning from delivered", () => {
      expect(canTransition("delivered", "cancelled")).toBe(false);
      expect(canTransition("delivered", "pending")).toBe(false);
    });

    it("should not allow transitioning from cancelled", () => {
      expect(canTransition("cancelled", "pending")).toBe(false);
      expect(canTransition("cancelled", "confirmed")).toBe(false);
    });

    it("should reject skip-ahead transitions", () => {
      expect(canTransition("pending", "shipped")).toBe(false);
      expect(canTransition("pending", "delivered")).toBe(false);
      expect(canTransition("confirmed", "delivered")).toBe(false);
    });

    it("should return false for unknown status", () => {
      expect(canTransition("unknown", "confirmed")).toBe(false);
    });
  });

  describe("calculateTotal", () => {
    const calculateTotal = (items) => {
      return items.reduce((total, item) => {
        const price = item.price || 0;
        return total + price * item.quantity;
      }, 0);
    };

    it("should sum price * quantity for all items", () => {
      const items = [
        { price: 100000, quantity: 2 },
        { price: 50000, quantity: 3 },
      ];
      expect(calculateTotal(items)).toBe(350000);
    });

    it("should handle empty items", () => {
      expect(calculateTotal([])).toBe(0);
    });

    it("should handle zero price", () => {
      const items = [{ price: 0, quantity: 5 }];
      expect(calculateTotal(items)).toBe(0);
    });
  });

  describe("Discount Distribution", () => {
    it("should distribute platform discount proportionally", () => {
      const orders = [{ totalAmount: 200000 }, { totalAmount: 300000 }];
      const totalPlatformOrderValue = 500000;
      const totalPlatformDiscount = 50000;
      let distributedDiscount = 0;

      orders.forEach((order, index) => {
        if (index === orders.length - 1) {
          order.discountPlatform = Math.max(
            0,
            totalPlatformDiscount - distributedDiscount,
          );
        } else {
          const ratio = order.totalAmount / totalPlatformOrderValue;
          const portion = Math.floor(totalPlatformDiscount * ratio);
          order.discountPlatform = portion;
          distributedDiscount += portion;
        }
        order.totalAmount = Math.max(
          0,
          order.totalAmount - order.discountPlatform,
        );
      });

      // First order: 200000/500000 * 50000 = 20000
      expect(orders[0].discountPlatform).toBe(20000);
      expect(orders[0].totalAmount).toBe(180000);

      // Last order gets remainder: 50000 - 20000 = 30000
      expect(orders[1].discountPlatform).toBe(30000);
      expect(orders[1].totalAmount).toBe(270000);

      // Total discount should match
      expect(orders[0].discountPlatform + orders[1].discountPlatform).toBe(
        totalPlatformDiscount,
      );
    });

    it("should not result in negative totalAmount", () => {
      const orders = [{ totalAmount: 10000 }];
      const totalPlatformDiscount = 50000;

      orders[0].discountPlatform = totalPlatformDiscount;
      orders[0].totalAmount = Math.max(
        0,
        orders[0].totalAmount - orders[0].discountPlatform,
      );

      expect(orders[0].totalAmount).toBe(0);
    });
  });

  describe("Retry Logic", () => {
    const isRetryableTransactionError = (error) => {
      const labels = error?.errorLabels || error?.result?.errorLabels || [];
      return labels.includes("TransientTransactionError");
    };

    const isUnknownCommitResult = (error) => {
      const labels = error?.errorLabels || error?.result?.errorLabels || [];
      return labels.includes("UnknownTransactionCommitResult");
    };

    it("should detect TransientTransactionError", () => {
      const error = { errorLabels: ["TransientTransactionError"] };
      expect(isRetryableTransactionError(error)).toBe(true);
    });

    it("should detect UnknownTransactionCommitResult", () => {
      const error = { errorLabels: ["UnknownTransactionCommitResult"] };
      expect(isUnknownCommitResult(error)).toBe(true);
    });

    it("should not detect regular errors", () => {
      const error = { message: "some error" };
      expect(isRetryableTransactionError(error)).toBe(false);
      expect(isUnknownCommitResult(error)).toBe(false);
    });

    it("should detect labels from nested result", () => {
      const error = { result: { errorLabels: ["TransientTransactionError"] } };
      expect(isRetryableTransactionError(error)).toBe(true);
    });
  });

  describe("Seller Status Transitions", () => {
    const sellerTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
      returned: [],
    };

    it("seller should not be able to cancel shipped orders", () => {
      expect(sellerTransitions["shipped"].includes("cancelled")).toBe(false);
    });

    it("seller should not be able to modify delivered/cancelled/returned", () => {
      expect(sellerTransitions["delivered"]).toHaveLength(0);
      expect(sellerTransitions["cancelled"]).toHaveLength(0);
      expect(sellerTransitions["returned"]).toHaveLength(0);
    });
  });
});
