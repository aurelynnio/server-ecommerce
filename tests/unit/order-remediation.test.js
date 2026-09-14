import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
const ApiError = require('../../src/utils/ApiError');
const idempotencyMiddleware = require('../../src/middlewares/idempotency.middleware');
const redisService = require('../../src/services/redis.service');
const { createOrderValidator, buyNowValidator } = require('../../src/validations/order.validator');
const orderService = require('../../src/services/order.service');
const Order = require('../../src/repositories/order.repository');
const Shop = require('../../src/repositories/shop.repository');
const Voucher = require('../../src/repositories/voucher.repository');
const { canTransition, ORDER_ACTORS } = require('../../src/shared/order/orderState');

describe('Order Remediation & Security Hardening Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(redisService, 'get').mockResolvedValue(null);
    vi.spyOn(redisService, 'set').mockResolvedValue();
    vi.spyOn(redisService, 'del').mockResolvedValue();
  });

  describe('Order State Transitions (Buyer Delivery Confirmation)', () => {
    it('should allow user to transition shipped -> delivered', () => {
      expect(canTransition('shipped', 'delivered', ORDER_ACTORS.USER)).toBe(true);
    });

    it('should still forbid user from cancelling shipped orders', () => {
      expect(canTransition('shipped', 'cancelled', ORDER_ACTORS.USER)).toBe(false);
    });
  });

  describe('Shop Voucher Validation - Duplicate shopId Constraint', () => {
    it('should reject shopVouchers with duplicate shopId entries', () => {
      const payload = {
        cartItemIds: ['507f1f77bcf86cd799439011'],
        addressId: '507f1f77bcf86cd799439012',
        paymentMethod: 'cod',
        shopVouchers: [
          { shopId: '507f1f77bcf86cd799439013', code: 'VOUCHER1' },
          { shopId: '507f1f77bcf86cd799439013', code: 'VOUCHER2' },
        ],
      };

      const { error } = createOrderValidator.validate(payload);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('contains a duplicate value');
    });

    it('should accept shopVouchers with distinct shopIds', () => {
      const payload = {
        cartItemIds: ['507f1f77bcf86cd799439011'],
        addressId: '507f1f77bcf86cd799439012',
        paymentMethod: 'cod',
        shopVouchers: [
          { shopId: '507f1f77bcf86cd799439013', code: 'VOUCHER1' },
          { shopId: '507f1f77bcf86cd799439014', code: 'VOUCHER2' },
        ],
      };

      const { error } = createOrderValidator.validate(payload);
      expect(error).toBeUndefined();
    });
  });

  describe('Idempotency Middleware', () => {
    it('should pass through if no idempotency key is provided', async () => {
      const req = { headers: {}, user: { userId: 'user123' } };
      const res = {};
      const next = vi.fn();

      const middleware = idempotencyMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 409 Conflict if request is currently processing', async () => {
      vi.spyOn(redisService, 'get').mockResolvedValue({ status: 'processing' });

      const req = {
        headers: { 'idempotency-key': 'key-123' },
        user: { userId: 'user123' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      const middleware = idempotencyMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('currently processing'),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return cached response if key is already completed', async () => {
      const cachedBody = { success: true, orderId: 'order-123' };
      vi.spyOn(redisService, 'get').mockResolvedValue({
        status: 'completed',
        statusCode: 201,
        body: cachedBody,
      });

      const req = {
        headers: { 'idempotency-key': 'key-completed' },
        user: { userId: 'user123' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        setHeader: vi.fn(),
      };
      const next = vi.fn();

      const middleware = idempotencyMiddleware();
      await middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Idempotent-Replayed', 'true');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(cachedBody);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Order Authorization Fixes (Admin Cancel & Merchant View)', () => {
    it('should allow seller who owns shop to view order via getOrderById', async () => {
      const mockOrder = {
        _id: 'order-1',
        userId: 'buyer-user-id',
        shopId: 'shop-abc',
      };

      vi.spyOn(Order, 'findByIdWithShopAndProducts').mockResolvedValue(mockOrder);
      vi.spyOn(Shop, 'findByIdLean').mockResolvedValue({
        _id: 'shop-abc',
        owner: 'seller-user-id',
      });

      const result = await orderService.getOrderById('order-1', 'seller-user-id', false);
      expect(result).toEqual(mockOrder);
    });

    it('should forbid non-owner user from viewing order via getOrderById', async () => {
      const mockOrder = {
        _id: 'order-1',
        userId: 'buyer-user-id',
        shopId: 'shop-abc',
      };

      vi.spyOn(Order, 'findByIdWithShopAndProducts').mockResolvedValue(mockOrder);
      vi.spyOn(Shop, 'findByIdLean').mockResolvedValue({
        _id: 'shop-abc',
        owner: 'other-seller-id',
      });

      await expect(orderService.getOrderById('order-1', 'stranger-id', false)).rejects.toThrow(
        ApiError,
      );
    });

    it('should allow admin to cancel order regardless of who placed it', async () => {
      const mockOrder = {
        _id: 'order-1',
        userId: 'buyer-user-id',
        status: 'pending',
        products: [],
      };

      vi.spyOn(orderService, '_cancelOrderAtomically').mockImplementation(
        async (callback, actor) => {
          expect(actor).toBe(ORDER_ACTORS.ADMIN);
          const mockSession = {};
          vi.spyOn(Order, 'findById').mockReturnValue({
            session: () => Promise.resolve(mockOrder),
          });
          return callback(mockSession);
        },
      );

      const result = await orderService.cancelOrder('order-1', 'admin-id', true);
      expect(result).toBe(mockOrder);
    });
  });
});
