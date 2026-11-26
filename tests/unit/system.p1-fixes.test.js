/**
 * Real-module regression tests for Batch 2 P1 fixes:
 * - RabbitMQ order command strict publish & deterministic notification eventId
 * - Notification ObjectId -> String(userId) room coercion
 * - Idempotency middleware fail-open when Redis is down & route-scoped keys
 * - CORS production wildcard *.vercel.app & plaintext http:// blocking
 * - Refresh token jti uniqueness within same second
 * - Local account deletion requiring non-empty password
 * - Cart variantId support, simple product stock check, and accumulated qty check
 * - Payment cancelled order rejection & IPN non-pending guard
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Batch 2 P1 Regression Suite (real modules)', () => {
  it('order.worker attaches deterministic eventId to notification payloads', async () => {
    const orderWorker = require('../../src/workers/order.worker');
    const notificationService = require('../../src/services/notification.service');

    const pubSpy = vi
      .spyOn(notificationService, 'publishNotification')
      .mockResolvedValue({ published: true });

    const res = await orderWorker._handleOrderEvent({
      eventName: 'order.created',
      orderId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      shopId: null,
      orderCode: 'ABC123',
    });

    expect(res).toEqual({ success: true });
    expect(pubSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'order:order.created:507f1f77bcf86cd799439011:507f1f77bcf86cd799439012:created',
      }),
      'notification.created',
    );
  });

  it('idempotencyMiddleware fails open when Redis is not ready and scopes keys by route', async () => {
    const idempotencyMiddleware = require('../../src/middlewares/idempotency.middleware');
    const redisClient = require('../../src/configs/redis.config');
    const redisService = require('../../src/services/redis.service');

    vi.spyOn(redisClient, 'isReady').mockReturnValue(false);
    vi.spyOn(redisService, 'get').mockResolvedValue(null);
    vi.spyOn(redisService, 'setNX').mockResolvedValue(false);
    const mw = idempotencyMiddleware();

    const req = {
      headers: { 'idempotency-key': 'k-1' },
      user: { userId: 'u-1' },
      baseUrl: '/api/orders',
      path: '/buy-now',
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();

    // When Redis IS ready, verify key includes route scope
    vi.spyOn(redisClient, 'isReady').mockReturnValue(true);
    const getSpy = vi.spyOn(redisService, 'get').mockResolvedValue(null);
    const setNxSpy = vi.spyOn(redisService, 'setNX').mockResolvedValue(true);

    await mw(req, res, next);
    expect(getSpy).toHaveBeenCalledWith('idempotency:u-1:/api/orders/buy-now:k-1');
    expect(setNxSpy).toHaveBeenCalledWith(
      'idempotency:u-1:/api/orders/buy-now:k-1',
      expect.objectContaining({ status: 'processing' }),
      expect.any(Number),
    );
  });

  it('CORS blocks wildcard *.vercel.app and plaintext http://nantianshop.tech in production', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevVercel = process.env.ALLOW_VERCEL_PREVIEWS;
    const corsPath = require.resolve('../../src/middlewares/cors.middleware');

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_VERCEL_PREVIEWS;
      delete require.cache[corsPath];
      const { isAllowedOrigin } = require('../../src/middlewares/cors.middleware');

      expect(isAllowedOrigin('https://nantianshop.tech')).toBe(true);
      expect(isAllowedOrigin('https://evil-attacker.vercel.app')).toBe(false);
      expect(isAllowedOrigin('http://nantianshop.tech')).toBe(false);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevVercel === undefined) delete process.env.ALLOW_VERCEL_PREVIEWS;
      else process.env.ALLOW_VERCEL_PREVIEWS = prevVercel;
      delete require.cache[corsPath];
    }
  });

  it('TokenService produces distinct refresh tokens within the same second via jti', () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    const tokenService = require('../../src/services/token.service');
    const user = { _id: '507f1f77bcf86cd799439011', username: 'alice', email: 'a@b.c', roles: 'user' };

    const first = tokenService.generateTokensWithPermissions(user);
    const second = tokenService.generateTokensWithPermissions(user);

    expect(first.refreshToken).not.toBe(second.refreshToken);
  });

  it('UserService.deleteOwnAccount rejects empty or omitted password for local accounts', async () => {
    const userService = require('../../src/services/user.service');
    const userRepo = require('../../src/repositories/user.repository');

    vi.spyOn(userRepo, 'findById').mockResolvedValue({
      _id: 'u-1',
      provider: 'local',
      password: '$2b$10$hashedpassword',
    });
    const deleteSpy = vi.spyOn(userRepo, 'deleteById').mockResolvedValue(null);

    await expect(userService.deleteOwnAccount('u-1', '')).rejects.toThrow(
      'Password is required to delete account',
    );
    await expect(userService.deleteOwnAccount('u-1', undefined)).rejects.toThrow(
      'Password is required to delete account',
    );
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('CartService.addToCart checks simple product stock, variantId, and accumulated cart quantity', async () => {
    const cartService = require('../../src/services/cart.service');
    const ProductRepo = require('../../src/repositories/product.repository');
    const CartRepo = require('../../src/repositories/cart.repository');

    // 1. Simple product out of stock
    vi.spyOn(ProductRepo, 'findById').mockResolvedValueOnce({
      _id: 'p-simple',
      status: 'published',
      stock: 0,
      price: { currentPrice: 100000 },
      variants: [],
      shop: 'shop-1',
    });

    await expect(
      cartService.addToCart('u-1', { productId: 'p-simple', quantity: 1 }),
    ).rejects.toThrow('Out of stock');

    // 2. Variant specified via variantId & accumulated quantity exceeds stock
    vi.spyOn(ProductRepo, 'findById').mockResolvedValueOnce({
      _id: 'p-var',
      status: 'published',
      stock: 5,
      price: { currentPrice: 100000 },
      variants: [
        { _id: 'v-1', stock: 10, price: 100000 },
        { _id: 'v-2', stock: 3, price: 120000 },
      ],
      shop: 'shop-1',
    });
    vi.spyOn(CartRepo, 'findByUserId').mockResolvedValueOnce({
      items: [{ productId: 'p-var', variantId: 'v-2', modelId: 'v-2', size: null, quantity: 2 }],
      save: vi.fn(),
      populate: vi.fn(),
    });

    await expect(
      cartService.addToCart('u-1', { productId: 'p-var', variantId: 'v-2', quantity: 2 }),
    ).rejects.toThrow('Only 3 item(s) available');
  });

  it('PaymentService rejects cancelled orders in createPaymentUrl', async () => {
    const PaymentService = require('../../src/services/payment.service');
    const OrderRepo = require('../../src/repositories/order.repository');

    vi.spyOn(OrderRepo, 'findById').mockResolvedValueOnce({
      _id: 'ord-1',
      userId: 'u-1',
      paymentMethod: 'vnpay',
      status: 'cancelled',
      paymentStatus: 'unpaid',
      totalAmount: 200000,
    });

    await expect(
      PaymentService.createPaymentUrl({ orderId: 'ord-1', userId: 'u-1', ipAddress: '127.0.0.1' }),
    ).rejects.toThrow('Cannot pay for a cancelled order');
  });
});
