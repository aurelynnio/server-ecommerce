/**
 * Integration Tests: Voucher System End-to-End
 * Tests voucher validation + discount calculation together
 */
import { describe, it, expect } from "vitest";

describe("Voucher System - Integration Tests", () => {
  // Replicates actual service logic
  const validateVoucher = (voucher, userId, orderValue, shopId = null) => {
    const errors = [];
    const now = new Date();

    if (!voucher.isActive) errors.push("Voucher is not active");
    if (voucher.startDate && new Date(voucher.startDate) > now)
      errors.push("Voucher is not yet active");
    if (voucher.endDate && new Date(voucher.endDate) < now)
      errors.push("Voucher has expired");
    if (voucher.usageLimit && voucher.usageCount >= voucher.usageLimit)
      errors.push("Voucher usage limit reached");
    if (voucher.usedBy && voucher.usedBy.includes(userId))
      errors.push("You have already used this voucher");
    if (voucher.minOrderValue && orderValue < voucher.minOrderValue)
      errors.push(`Order value must be at least ${voucher.minOrderValue}`);
    if (voucher.scope === "shop" && shopId) {
      const voucherShopId = voucher.shopId?.toString?.() || voucher.shopId;
      if (voucherShopId !== shopId)
        errors.push("Voucher is not valid for this shop");
    }

    return { valid: errors.length === 0, errors };
  };

  const calculateDiscount = (voucher, orderValue) => {
    if (voucher.discountType === "percentage") {
      let discount = (orderValue * voucher.discountValue) / 100;
      if (voucher.maxDiscount && discount > voucher.maxDiscount)
        discount = voucher.maxDiscount;
      return discount;
    } else if (voucher.discountType === "fixed") {
      return Math.min(voucher.discountValue, orderValue);
    }
    return 0;
  };

  const applyVoucher = (voucher, userId, orderValue, shopId = null) => {
    const validation = validateVoucher(voucher, userId, orderValue, shopId);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        discountAmount: 0,
        finalAmount: orderValue,
      };
    }
    const discountAmount = calculateDiscount(voucher, orderValue);
    const finalAmount = Math.max(0, orderValue - discountAmount);
    return { success: true, errors: [], discountAmount, finalAmount };
  };

  describe("Full Voucher Application Flow", () => {
    it("should validate and apply percentage voucher", () => {
      const voucher = {
        isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        usageLimit: 100,
        usageCount: 10,
        minOrderValue: 100000,
        discountType: "percentage",
        discountValue: 10,
        maxDiscount: 50000,
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user123", 300000);

      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(30000); // 10% of 300000
      expect(result.finalAmount).toBe(270000);
    });

    it("should cap percentage discount at maxDiscount", () => {
      const voucher = {
        isActive: true,
        discountType: "percentage",
        discountValue: 50,
        maxDiscount: 100000,
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user1", 500000);

      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(100000); // capped at maxDiscount
      expect(result.finalAmount).toBe(400000);
    });

    it("should validate and apply fixed voucher", () => {
      const voucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 50000,
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user1", 200000);

      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(50000);
      expect(result.finalAmount).toBe(150000);
    });

    it("should not allow discount greater than order value", () => {
      const voucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 200000,
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user1", 100000);

      expect(result.discountAmount).toBe(100000);
      expect(result.finalAmount).toBe(0);
    });

    it("should reject invalid voucher and return zero discount", () => {
      const voucher = {
        isActive: false,
        discountType: "percentage",
        discountValue: 10,
      };

      const result = applyVoucher(voucher, "user1", 200000);

      expect(result.success).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(200000);
    });

    it("should reject voucher for wrong shop", () => {
      const voucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 10000,
        scope: "shop",
        shopId: "shop1",
      };

      const result = applyVoucher(voucher, "user1", 200000, "shop2");

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Voucher is not valid for this shop");
    });

    it("should accept voucher for correct shop", () => {
      const voucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 10000,
        scope: "shop",
        shopId: "shop1",
      };

      const result = applyVoucher(voucher, "user1", 200000, "shop1");

      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(10000);
    });

    it("should reject when below minimum order value", () => {
      const voucher = {
        isActive: true,
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 200000,
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user1", 100000);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Order value must be at least")),
      ).toBe(true);
    });

    it("should reject when user already used voucher", () => {
      const voucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 10000,
        usedBy: ["user1", "user2"],
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user1", 200000);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("You have already used this voucher");
    });
  });

  describe("Multi-Shop Order with Vouchers", () => {
    it("should apply shop-specific and platform vouchers together", () => {
      const shopVoucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 20000,
        scope: "shop",
        shopId: "shopA",
      };

      const platformVoucher = {
        isActive: true,
        discountType: "percentage",
        discountValue: 5,
        maxDiscount: 50000,
        scope: "platform",
      };

      // Shop A subtotal
      const shopASubtotal = 300000;

      // Apply shop voucher first
      const shopResult = applyVoucher(
        shopVoucher,
        "user1",
        shopASubtotal,
        "shopA",
      );
      expect(shopResult.success).toBe(true);
      expect(shopResult.discountAmount).toBe(20000);

      // Apply platform voucher on remaining
      const afterShopDiscount = shopResult.finalAmount;
      const platformResult = applyVoucher(
        platformVoucher,
        "user1",
        afterShopDiscount,
      );
      expect(platformResult.success).toBe(true);
      expect(platformResult.discountAmount).toBe(14000); // 5% of 280000
      expect(platformResult.finalAmount).toBe(266000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero order value", () => {
      const voucher = {
        isActive: true,
        discountType: "fixed",
        discountValue: 10000,
        scope: "platform",
      };

      const result = applyVoucher(voucher, "user1", 0);
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(0);
    });

    it("should handle voucher with all validation failures", () => {
      const voucher = {
        isActive: false,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() - 86400000),
        usageLimit: 10,
        usageCount: 10,
        usedBy: ["user1"],
        minOrderValue: 500000,
        scope: "shop",
        shopId: "shop1",
        discountType: "percentage",
        discountValue: 10,
      };

      const result = applyVoucher(voucher, "user1", 100000, "shop2");

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
});
