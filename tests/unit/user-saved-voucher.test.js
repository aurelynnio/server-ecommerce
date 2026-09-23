/**
 * Unit Tests: User Saved Voucher (Voucher Wallet) Logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UserSavedVoucher Service Logic', () => {
  // Test pure computation logic for saved voucher status
  const computeVoucherStatus = (voucher, usedCount = 0, now = new Date()) => {
    const limitPerUser =
      typeof voucher.usageLimitPerUser === 'number' ? voucher.usageLimitPerUser : 1;
    const remainingUsage =
      limitPerUser === 0 ? 999999 : Math.max(0, limitPerUser - usedCount);

    let status = 'valid';
    if (!voucher.isActive || new Date(voucher.endDate) < now) {
      status = 'expired';
    } else if (limitPerUser > 0 && usedCount >= limitPerUser) {
      status = 'used';
    }

    return { status, usedCount, remainingUsage };
  };

  it('should mark active voucher with remaining limit as valid', () => {
    const voucher = {
      isActive: true,
      endDate: new Date(Date.now() + 86400000), // tomorrow
      usageLimitPerUser: 2,
    };

    const result = computeVoucherStatus(voucher, 1);
    expect(result.status).toBe('valid');
    expect(result.remainingUsage).toBe(1);
    expect(result.usedCount).toBe(1);
  });

  it('should mark voucher as used when user reached limit', () => {
    const voucher = {
      isActive: true,
      endDate: new Date(Date.now() + 86400000),
      usageLimitPerUser: 1,
    };

    const result = computeVoucherStatus(voucher, 1);
    expect(result.status).toBe('used');
    expect(result.remainingUsage).toBe(0);
  });

  it('should mark voucher as expired when endDate is in the past', () => {
    const voucher = {
      isActive: true,
      endDate: new Date(Date.now() - 10000), // past
      usageLimitPerUser: 5,
    };

    const result = computeVoucherStatus(voucher, 0);
    expect(result.status).toBe('expired');
  });

  it('should mark inactive voucher as expired', () => {
    const voucher = {
      isActive: false,
      endDate: new Date(Date.now() + 86400000),
      usageLimitPerUser: 5,
    };

    const result = computeVoucherStatus(voucher, 0);
    expect(result.status).toBe('expired');
  });

  it('should handle unlimited per-user voucher (usageLimitPerUser = 0)', () => {
    const voucher = {
      isActive: true,
      endDate: new Date(Date.now() + 86400000),
      usageLimitPerUser: 0,
    };

    const result = computeVoucherStatus(voucher, 10);
    expect(result.status).toBe('valid');
  });
});
