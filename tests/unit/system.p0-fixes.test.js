/**
 * Real-module regression tests for Batch 1 P0 fixes:
 * - RabbitMQ embedding publisher exchange & worker queue/prefetch/metrics
 * - VNPay signature verification & PaymentController userId/admin resolution
 * - Variant stock deduction $elemMatch
 * - Voucher platform ownership & scope escalation guard
 * - Flash Sale router cross-tenant ownership middleware
 * - Order cancellation transaction error propagation
 * - Refresh token logout revocation enforcement
 * - requirePermission DB demotion & negative permission enforcement
 * - Socket.IO get_notifications null payload DoS guard
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Batch 1 P0 Regression Suite (real modules)', () => {
  describe('1-3. RabbitMQ embedding publisher & worker', () => {
    it('publishes embedding events to config_rabbitMQ.exchange.name (never undefined)', async () => {
      const rabbitConfig = require('../../src/configs/rabbitMQ.config');
      const embeddingSyncService = require('../../src/services/embedding-sync.service');

      const publish = vi.fn().mockResolvedValue(true);
      vi.spyOn(rabbitConfig, 'connectRabbitMQ').mockResolvedValue({
        connection: {},
        channel: { publish },
        queue: rabbitConfig.config_rabbitMQ.queues.embedding,
      });

      const ok = await embeddingSyncService.publishEmbeddingEvent(
        { eventName: 'embedding.sync', productId: 'prod-1' },
        'embedding.sync',
        { strict: true },
      );

      expect(ok).toBe(true);
      expect(publish).toHaveBeenCalledWith(
        rabbitConfig.config_rabbitMQ.exchange.name,
        'embedding.sync',
        expect.any(Buffer),
        expect.objectContaining({ persistent: true, contentType: 'application/json' }),
      );
      expect(publish.mock.calls[0][0]).toBeTruthy();
    });

    it('consumes queue.name via addSetup(prefetch) and ACKs valid messages without metrics.duration crash', async () => {
      const rabbitConfig = require('../../src/configs/rabbitMQ.config');
      const consumerEmbeddingQueue = require('../../src/workers/embedding.worker');

      let consumedQueueName = null;
      let onMessage = null;
      const prefetch = vi.fn().mockResolvedValue(undefined);
      const ack = vi.fn();
      const nack = vi.fn();

      const mockChannel = {
        addSetup: vi.fn(async (fn) => fn({ prefetch })),
        consume: vi.fn(async (queueName, handler) => {
          consumedQueueName = queueName;
          onMessage = handler;
        }),
        ack,
        nack,
      };

      vi.spyOn(rabbitConfig, 'connectRabbitMQ').mockResolvedValue({
        connection: {},
        channel: mockChannel,
        queue: rabbitConfig.config_rabbitMQ.queues.embedding,
      });

      await consumerEmbeddingQueue();

      expect(consumedQueueName).toBe('embedding_queue');
      expect(prefetch).toHaveBeenCalledWith(expect.any(Number));
      expect(typeof onMessage).toBe('function');

      const msg = {
        content: Buffer.from(JSON.stringify({ eventName: 'embedding.sync' })),
        properties: { headers: {} },
      };
      await onMessage(msg);

      expect(ack).toHaveBeenCalledWith(msg);
      expect(nack).not.toHaveBeenCalled();
    });
  });

  describe('4-5. VNPay signature verification & PaymentController', () => {
    it('rejects forged VNPay Return URL and IPN signatures when vnpay returns { isVerified: false }', async () => {
      process.env.VNP_TMNCODE = process.env.VNP_TMNCODE || 'TESTCODE';
      process.env.VNP_HASHSECRET = process.env.VNP_HASHSECRET || 'TESTSECRET1234567890';
      const PaymentService = require('../../src/services/payment.service');

      const forgedParams = {
        vnp_TxnRef: 'TXN123456',
        vnp_Amount: '10000000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_SecureHash: 'FORGED_HASH',
      };

      await expect(PaymentService.verifyReturnUrl(forgedParams)).rejects.toThrow(
        'Invalid signature',
      );

      const ipnRes = await PaymentService.handleIPN(forgedParams);
      expect(ipnRes).toEqual({
        RspCode: '97',
        Message: 'Invalid signature',
      });

      const badAmountIpn = await PaymentService.handleIPN({
        vnp_TxnRef: 'TXN123456',
        vnp_ResponseCode: '00',
        vnp_SecureHash: 'FORGED_HASH',
      });
      expect(badAmountIpn.RspCode).toBe('04');
    });

    it('PaymentController resolves getRequestUserId and isRequestUserAdmin without TypeError', async () => {
      const PaymentController = require('../../src/controllers/payment.controller');
      const PaymentService = require('../../src/services/payment.service');

      const spy = vi
        .spyOn(PaymentService, 'getPaymentByOrderId')
        .mockResolvedValue({ _id: 'pay-1', amount: 100000 });

      const req = {
        params: { orderId: 'order-1' },
        user: { userId: 'admin-1', role: 'admin' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await PaymentController.getPaymentByOrder(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith('order-1', 'admin-1', true);
    });
  });

  describe('6. Variant stock deduction uses $elemMatch', () => {
    it('queries variants with $elemMatch for both normal sale and flash sale', async () => {
      const ProductRepo = require('../../src/repositories/product.repository');
      const updateSpy = vi
        .spyOn(ProductRepo, 'updateOneByFilter')
        .mockResolvedValue({ modifiedCount: 1 });

      await ProductRepo.decrementStockForVariantSale('prod-1', 'var-1', 2, null);
      await ProductRepo.decrementStockForVariantFlashSale('prod-1', 'var-1', 3, null);

      expect(updateSpy.mock.calls[0][0]).toMatchObject({
        _id: 'prod-1',
        status: 'published',
        variants: { $elemMatch: { _id: 'var-1', stock: { $gte: 2 } } },
      });
      expect(updateSpy.mock.calls[0][0]['variants._id']).toBeUndefined();

      expect(updateSpy.mock.calls[1][0]).toMatchObject({
        _id: 'prod-1',
        status: 'published',
        variants: { $elemMatch: { _id: 'var-1', stock: { $gte: 3 } } },
        'flashSale.isActive': true,
      });
      expect(updateSpy.mock.calls[1][0]['variants._id']).toBeUndefined();
    });
  });

  describe('7. Voucher platform ownership & scope escalation guard', () => {
    it('blocks a seller from updating or deleting a platform voucher', async () => {
      const voucherService = require('../../src/services/voucher.service');
      const platformVoucher = {
        _id: 'v-1',
        code: 'PLATFORM50',
        scope: 'platform',
        shopId: null,
        save: vi.fn(),
      };

      vi.spyOn(voucherService, '_getVoucherOrThrow').mockResolvedValue(platformVoucher);

      await expect(
        voucherService.updateVoucher('v-1', { value: 100 }, 'seller-1', ['seller']),
      ).rejects.toThrow('Unauthorized to update platform voucher');

      await expect(
        voucherService.deleteVoucher('v-1', 'seller-1', ['seller']),
      ).rejects.toThrow('Unauthorized to delete platform voucher');
    });
  });

  describe('8. Flash Sale router enforces ownership middleware', () => {
    it('wires ownership check middleware on POST and DELETE /:productId', () => {
      const flashSaleRouter = require('../../src/routes/flash-sale.router');
      const productIdRoutes = flashSaleRouter.stack
        .filter((layer) => layer.route?.path === '/:productId')
        .map((layer) => ({
          methods: layer.route.methods,
          names: layer.route.stack.map((s) => s.name),
        }));

      expect(productIdRoutes).toHaveLength(2);
      for (const route of productIdRoutes) {
        expect(route.names).toContain('verifyFlashSaleProductOwnership');
      }
    });
  });

  describe('9. Order cancellation error propagation', () => {
    it('throws the real ApiError from txn.error instead of TypeError on aborted cancel', async () => {
      const mongoose = require('mongoose');
      const orderService = require('../../src/services/order.service');
      const ApiError = require('../../src/utils/ApiError');

      vi.spyOn(mongoose, 'startSession').mockResolvedValue({
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
        inTransaction: () => false,
      });

      await expect(
        orderService._cancelOrderAtomically(async () => {
          throw new ApiError(404, 'Order not found');
        }, 'user'),
      ).rejects.toThrow('Order not found');
    });
  });

  describe('10. Refresh token logout revocation enforcement', () => {
    it('rejects a valid refresh JWT when refreshTokenHash is null after logout', async () => {
      const authService = require('../../src/services/auth.service');
      const tokenService = require('../../src/services/token.service');
      const UserRepo = require('../../src/repositories/user.repository');

      vi.spyOn(tokenService, 'verifyRefreshToken').mockReturnValue({ userId: 'user-1' });
      vi.spyOn(UserRepo, 'findByIdWithRefreshFields').mockResolvedValue({
        _id: 'user-1',
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      });

      await expect(authService.refreshAccessToken('valid-old-jwt')).rejects.toThrow(
        'Invalid or revoked refresh token',
      );
    });
  });

  describe('11. requirePermission enforces DB demotions and negative permissions', () => {
    it('denies access when DB demoted admin to user despite stale JWT role=admin', async () => {
      const { requirePermission } = require('../../src/middlewares/permission.middleware');
      const permissionService = require('../../src/services/permission.service');

      vi.spyOn(permissionService, 'getEffectivePermissionsByUserId').mockResolvedValue([
        'product:read',
        'cart:read',
      ]);

      const middleware = requirePermission('admin:access');
      const req = { user: { userId: 'user-1', role: 'admin' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('12. Socket.IO get_notifications null payload DoS guard', () => {
    it('handles null payload without throwing or causing unhandledRejection', async () => {
      const notificationSocket = require('../../src/socket/notification.socket');
      const notificationService = require('../../src/services/notification.service');

      vi.spyOn(notificationService, 'getListNotification').mockResolvedValue({
        notifications: [],
        pagination: { page: 1, limit: 10, total: 0 },
      });

      const handlers = {};
      const socket = {
        user: { id: 'user-1' },
        join: vi.fn(),
        on: vi.fn((event, fn) => {
          handlers[event] = fn;
        }),
        emit: vi.fn(),
      };
      const io = { to: vi.fn(() => ({ emit: vi.fn() })) };

      notificationSocket(io, socket);
      await expect(handlers.get_notifications(null)).resolves.toBeUndefined();
      expect(socket.emit).toHaveBeenCalledWith(
        'list_notification',
        expect.objectContaining({ notifications: [] }),
      );
    });
  });
});
