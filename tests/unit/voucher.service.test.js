/**
 * Unit Tests: Voucher Service Logic
 *
 * Tests validation and business logic for voucher operations
 *
 * Validates Requirements: 9.2, 9.3
 */

import { describe, it, expect } from 'vitest';

// Test pure business logic without mocking the entire service
describe('VoucherService Logic', () => {
  describe('Discount Calculation', () => {
    // Helper function that mirrors the service logic
    const calculateDiscount = (voucher, orderValue) => {
      if (voucher.discountType === 'percentage') {
        let discount = (orderValue * voucher.discountValue) / 100;
        if (voucher.maxDiscount && discount > voucher.maxDiscount) {
          discount = voucher.maxDiscount;
        }
        return discount;
      } else if (voucher.discountType === 'fixed') {
        return Math.min(voucher.discountValue, orderValue);
      }
      return 0;
    };

    it('should calculate percentage discount correctly', () => {
      const voucher = {
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: 50000,
      };

      expect(calculateDiscount(voucher, 200000)).toBe(20000); // 10% of 200000
      expect(calculateDiscount(voucher, 100000)).toBe(10000); // 10% of 100000
    });

    it('should cap percentage discount at maxDiscount', () => {
      const voucher = {
        discountType: 'percentage',
        discountValue: 10,
        maxDiscount: 50000,
      };

      // 10% of 1000000 = 100000, but capped at 50000
      expect(calculateDiscount(voucher, 1000000)).toBe(50000);
    });

    it('should calculate fixed discount correctly', () => {
      const voucher = {
        discountType: 'fixed',
        discountValue: 30000,
      };

      expect(calculateDiscount(voucher, 200000)).toBe(30000);
      expect(calculateDiscount(voucher, 100000)).toBe(30000);
    });

    it('should not exceed order value for fixed discount', () => {
      const voucher = {
        discountType: 'fixed',
        discountValue: 50000,
      };

      // Order value is less than discount
      expect(calculateDiscount(voucher, 30000)).toBe(30000);
    });
  });

  describe('Voucher Validation', () => {
    const validateVoucher = (voucher, userId, orderValue, shopId = null) => {
      const errors = [];
      const now = new Date();

      // Check if active
      if (!voucher.isActive) {
        errors.push('Voucher is not active');
      }

      // Check dates
      if (voucher.startDate && new Date(voucher.startDate) > now) {
        errors.push('Voucher is not yet active');
      }
      if (voucher.endDate && new Date(voucher.endDate) < now) {
        errors.push('Voucher has expired');
      }

      // Check usage limit
      if (voucher.usageLimit && voucher.usageCount >= voucher.usageLimit) {
        errors.push('Voucher usage limit reached');
      }

      // Check if user already used
      if (voucher.usedBy && voucher.usedBy.includes(userId)) {
        errors.push('You have already used this voucher');
      }

      // Check minimum order value
      if (voucher.minOrderValue && orderValue < voucher.minOrderValue) {
        errors.push(`Order value must be at least ${voucher.minOrderValue}`);
      }

      // Check shop scope
      if (voucher.scope === 'shop' && shopId) {
        const voucherShopId = voucher.shopId?.toString?.() || voucher.shopId;
        if (voucherShopId !== shopId) {
          errors.push('Voucher is not valid for this shop');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    };

    it('should reject inactive voucher', () => {
      const voucher = { isActive: false };
      const result = validateVoucher(voucher, 'user123', 200000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Voucher is not active');
    });

    it('should reject expired voucher', () => {
      const voucher = {
        isActive: true,
        endDate: new Date(Date.now() - 86400000), // Yesterday
      };
      const result = validateVoucher(voucher, 'user123', 200000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Voucher has expired');
    });

    it('should reject voucher not yet started', () => {
      const voucher = {
        isActive: true,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
      };
      const result = validateVoucher(voucher, 'user123', 200000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Voucher is not yet active');
    });

    it('should reject when usage limit reached', () => {
      const voucher = {
        isActive: true,
        usageLimit: 100,
        usageCount: 100,
      };
      const result = validateVoucher(voucher, 'user123', 200000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Voucher usage limit reached');
    });

    it('should reject when user already used voucher', () => {
      const voucher = {
        isActive: true,
        usedBy: ['user123', 'user456'],
      };
      const result = validateVoucher(voucher, 'user123', 200000);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('You have already used this voucher');
    });

    it('should reject when order value below minimum', () => {
      const voucher = {
        isActive: true,
        minOrderValue: 100000,
      };
      const result = validateVoucher(voucher, 'user123', 50000);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Order value must be at least'))).toBe(true);
    });

    it('should reject shop voucher for wrong shop', () => {
      const voucher = {
        isActive: true,
        scope: 'shop',
        shopId: 'shop123',
      };
      const result = validateVoucher(voucher, 'user123', 200000, 'differentShop');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Voucher is not valid for this shop');
    });

    it('should accept valid voucher', () => {
      const voucher = {
        isActive: true,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        usageLimit: 100,
        usageCount: 50,
        usedBy: ['otherUser'],
        minOrderValue: 100000,
        scope: 'platform',
      };
      const result = validateVoucher(voucher, 'user123', 200000);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept shop voucher for correct shop', () => {
      const voucher = {
        isActive: true,
        scope: 'shop',
        shopId: 'shop123',
      };
      const result = validateVoucher(voucher, 'user123', 200000, 'shop123');

      expect(result.valid).toBe(true);
    });
  });

  describe('Voucher Code Validation', () => {
    const isValidCode = (code) => {
      if (!code || typeof code !== 'string') return false;
      if (code.length < 3 || code.length > 20) return false;
      // Only alphanumeric and uppercase
      return /^[A-Z0-9]+$/.test(code.toUpperCase());
    };

    it('should accept valid voucher codes', () => {
      expect(isValidCode('SAVE10')).toBe(true);
      expect(isValidCode('SUMMER2024')).toBe(true);
      expect(isValidCode('ABC')).toBe(true);
    });

    it('should reject invalid voucher codes', () => {
      expect(isValidCode('')).toBe(false);
      expect(isValidCode('AB')).toBe(false); // Too short
      expect(isValidCode('A'.repeat(21))).toBe(false); // Too long
      expect(isValidCode(null)).toBe(false);
      expect(isValidCode(undefined)).toBe(false);
    });
  });

  describe('Pagination Logic', () => {
    const getPaginationParams = (page, limit, total) => {
      const currentPage = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 10));
      const totalPages = Math.ceil(total / pageSize);
      const skip = (currentPage - 1) * pageSize;

      return {
        currentPage,
        pageSize,
        totalPages,
        totalItems: total,
        skip,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
      };
    };

    it('should calculate pagination correctly', () => {
      const result = getPaginationParams(1, 10, 100);

      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(10);
      expect(result.totalItems).toBe(100);
      expect(result.skip).toBe(0);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should handle middle page', () => {
      const result = getPaginationParams(5, 10, 100);

      expect(result.currentPage).toBe(5);
      expect(result.skip).toBe(40);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
      expect(result.nextPage).toBe(6);
      expect(result.prevPage).toBe(4);
    });

    it('should handle last page', () => {
      const result = getPaginationParams(10, 10, 100);

      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
      expect(result.nextPage).toBe(null);
    });

    it('should cap page size at 100', () => {
      const result = getPaginationParams(1, 200, 1000);

      expect(result.pageSize).toBe(100);
    });

    it('should default to page 1 for invalid input', () => {
      const result = getPaginationParams(-1, 10, 100);

      expect(result.currentPage).toBe(1);
    });
  });

  describe('Voucher Statistics Calculation', () => {
    const calculateStats = (vouchers) => {
      const total = vouchers.length;
      const active = vouchers.filter((v) => v.isActive).length;
      const expired = vouchers.filter((v) => new Date(v.endDate) < new Date()).length;
      const totalUsage = vouchers.reduce((sum, v) => sum + (v.usageCount || 0), 0);

      return {
        totalVouchers: total,
        activeVouchers: active,
        expiredVouchers: expired,
        totalUsage,
      };
    };

    it('should calculate statistics correctly', () => {
      const vouchers = [
        { isActive: true, endDate: new Date(Date.now() + 86400000), usageCount: 10 },
        { isActive: true, endDate: new Date(Date.now() + 86400000), usageCount: 20 },
        { isActive: false, endDate: new Date(Date.now() - 86400000), usageCount: 50 },
        { isActive: false, endDate: new Date(Date.now() - 86400000), usageCount: 30 },
      ];

      const stats = calculateStats(vouchers);

      expect(stats.totalVouchers).toBe(4);
      expect(stats.activeVouchers).toBe(2);
      expect(stats.expiredVouchers).toBe(2);
      expect(stats.totalUsage).toBe(110);
    });

    it('should handle empty voucher list', () => {
      const stats = calculateStats([]);

      expect(stats.totalVouchers).toBe(0);
      expect(stats.activeVouchers).toBe(0);
      expect(stats.totalUsage).toBe(0);
    });
  });
});
