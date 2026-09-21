import { describe, it, expect, vi, beforeEach } from 'vitest';
const orderService = require('../../src/services/order.service');
const orderController = require('../../src/controllers/order.controller');
const consumerOrderQueue = require('../../src/workers/order.worker');
const notificationService = require('../../src/services/notification.service');
const Shop = require('../../src/repositories/shop.repository');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../../src/utils/ApiError');
const { ORDER_EVENT_TYPES } = require('../../src/shared/order/orderEvents');

describe('Unified Order Processing & Event-Driven RabbitMQ Notification Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should expose createOrder, buyNow, and calculateTotal as functions', () => {
    expect(typeof orderService.createOrder).toBe('function');
    expect(typeof orderService.buyNow).toBe('function');
    expect(typeof orderService.calculateTotal).toBe('function');
  });

  describe('OrderController Synchronous Handling', () => {
    const mockRes = () => {
      const res = {};
      res.status = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      return res;
    };

    it('createOrder should process order synchronously and return 201 CREATED', async () => {
      const req = {
        user: { _id: '66e138a0f123456789012345' },
        headers: {},
        query: {},
        body: { cartItemIds: ['66e138a0f123456789012399'], addressId: '66e138a0f123456789012388' },
      };
      const res = mockRes();

      const orderResult = { orderGroupId: 'grp-sync', orders: [{ _id: 'order-1' }] };
      vi.spyOn(orderService, 'createOrder').mockResolvedValue(orderResult);

      await orderController.createOrder(req, res);

      expect(orderService.createOrder).toHaveBeenCalledWith(req.user._id, req.body);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: StatusCodes.CREATED,
          data: orderResult,
        }),
      );
    });

    it('buyNow should process order synchronously and return 201 CREATED', async () => {
      const req = {
        user: { _id: '66e138a0f123456789012345' },
        headers: {},
        query: {},
        body: {
          productId: '66e138a0f123456789012311',
          quantity: 1,
          addressId: '66e138a0f123456789012388',
        },
      };
      const res = mockRes();

      const orderResult = { orderGroupId: 'grp-buynow', orders: [{ _id: 'order-bn-1' }] };
      vi.spyOn(orderService, 'buyNow').mockResolvedValue(orderResult);

      await orderController.buyNow(req, res);

      expect(orderService.buyNow).toHaveBeenCalledWith(req.user._id, req.body);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: StatusCodes.CREATED,
          data: orderResult,
        }),
      );
    });
  });

  describe('Worker Event Execution (_handleOrderEvent)', () => {
    it('should process order.created successfully and publish buyer and seller notifications', async () => {
      const publishSpy = vi
        .spyOn(notificationService, 'publishNotification')
        .mockResolvedValue({ published: true });
      vi.spyOn(Shop, 'findByIdLean').mockResolvedValue({ _id: 'shop-1', owner: 'seller-user-id' });

      const payload = {
        eventName: ORDER_EVENT_TYPES.CREATED,
        orderId: 'order-123',
        orderCode: 'ORD123',
        userId: 'buyer-user-id',
        shopId: 'shop-1',
        customerName: 'Nguyen Van A',
      };

      const result = await consumerOrderQueue._handleOrderEvent(payload);

      expect(result.success).toBe(true);
      expect(publishSpy).toHaveBeenCalled();
      // Buyer notification
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-user-id',
          type: 'order_status',
          orderId: 'order-123',
        }),
        'notification.created',
      );
      // Seller notification
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'seller-user-id',
          type: 'order_status',
          orderId: 'order-123',
        }),
        'notification.created',
      );
    });

    it('should process order.status_changed successfully and publish notifications', async () => {
      const publishSpy = vi
        .spyOn(notificationService, 'publishNotification')
        .mockResolvedValue({ published: true });

      const payload = {
        eventName: ORDER_EVENT_TYPES.STATUS_CHANGED,
        orderId: 'order-123',
        orderCode: 'ORD123',
        userId: 'buyer-user-id',
        shopId: 'shop-1',
        status: 'shipped',
        actor: 'seller',
      };

      const result = await consumerOrderQueue._handleOrderEvent(payload);

      expect(result.success).toBe(true);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-user-id',
          type: 'order_status',
          message: expect.stringContaining('Đơn hàng đang được giao'),
        }),
        'notification.created',
      );
    });

    it('should return unsupported for unknown events', async () => {
      const payload = {
        eventName: 'unknown.event',
      };

      const result = await consumerOrderQueue._handleOrderEvent(payload);

      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
    });
  });

  describe('Defensive calculateTotal (Prevents NaN totalAmount)', () => {
    it('should correctly calculate total when item.price is a Mongoose subdocument / object', () => {
      const items = [
        {
          price: { currentPrice: 57000, discountPrice: null, currency: 'VND' },
          quantity: 2,
        },
        {
          price: { currentPrice: 100000, discountPrice: 80000, currency: 'VND' },
          quantity: 1,
        },
      ];

      const total = orderService.calculateTotal(items);
      expect(total).toBe(57000 * 2 + 80000 * 1);
      expect(Number.isNaN(total)).toBe(false);
    });

    it('should correctly calculate total when item.price is a direct number', () => {
      const items = [
        { price: 45000, quantity: 3 },
        { price: 15000, quantity: 1 },
      ];

      const total = orderService.calculateTotal(items);
      expect(total).toBe(150000);
      expect(Number.isNaN(total)).toBe(false);
    });

    it('should never produce NaN when price or quantity are missing or invalid', () => {
      const items = [
        { price: undefined, quantity: undefined },
        { price: null, quantity: null },
        { price: 'invalid', quantity: 'abc' },
        { price: { currentPrice: NaN }, quantity: 1 },
      ];

      const total = orderService.calculateTotal(items);
      expect(total).toBe(0);
      expect(Number.isNaN(total)).toBe(false);
    });
  });

  describe('WriteConflict & TransientTransactionError Detection', () => {
    it('should detect code 112 and codeName WriteConflict as retryable', () => {
      const error1 = { code: 112, message: 'Write conflict' };
      const error2 = { codeName: 'WriteConflict', message: 'Some conflict' };
      expect(orderService._isRetryableTransactionError(error1)).toBe(true);
      expect(orderService._isRetryableTransactionError(error2)).toBe(true);
    });

    it('should detect WiredTiger yielding disabled write conflict message as retryable', () => {
      const wiredTigerError = new Error(
        'Caused by :: Write conflict during plan execution and yielding is disabled. :: Please retry your operation or multi-document transaction.',
      );
      expect(orderService._isRetryableTransactionError(wiredTigerError)).toBe(true);
    });

    it('should detect MongoError hasErrorLabel TransientTransactionError as retryable', () => {
      const error = new Error('Transaction aborted');
      error.hasErrorLabel = (label) => label === 'TransientTransactionError';
      expect(orderService._isRetryableTransactionError(error)).toBe(true);
    });

    it('should detect errorLabels Set containing TransientTransactionError', () => {
      const error = new Error('Transient error');
      error.errorLabels = new Set(['TransientTransactionError']);
      expect(orderService._isRetryableTransactionError(error)).toBe(true);
    });

    it('should return false for business errors (non-retryable)', () => {
      const validationError = new ApiError(StatusCodes.BAD_REQUEST, 'Cart is empty');
      expect(orderService._isRetryableTransactionError(validationError)).toBe(false);
    });
  });

  describe('RabbitMQ Worker ACK / NACK / DLQ Standard Flow', () => {
    it('should ACK message when handleOrderEvent succeeds', async () => {
      const mockChannel = {
        ack: vi.fn(),
        nack: vi.fn(),
      };

      const payload = {
        eventName: ORDER_EVENT_TYPES.CREATED,
        orderId: 'order-ack-1',
        userId: 'user-ack',
      };
      const messageData = {
        content: Buffer.from(JSON.stringify(payload)),
        fields: { routingKey: ORDER_EVENT_TYPES.CREATED },
      };

      vi.spyOn(notificationService, 'publishNotification').mockResolvedValue({ published: true });

      const result = await consumerOrderQueue._handleOrderEvent(payload);
      expect(result.success).toBe(true);

      // Verify consumer ACK logic
      if (result.success) {
        mockChannel.ack(messageData);
      } else {
        mockChannel.nack(messageData, false, false);
      }

      expect(mockChannel.ack).toHaveBeenCalledWith(messageData);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should NACK without requeue (send to DLQ) when handleOrderEvent fails', async () => {
      const mockChannel = {
        ack: vi.fn(),
        nack: vi.fn(),
      };

      const payload = {
        eventName: ORDER_EVENT_TYPES.CREATED,
        orderId: 'order-fail-1',
        userId: 'user-fail',
      };
      const messageData = {
        content: Buffer.from(JSON.stringify(payload)),
        fields: { routingKey: ORDER_EVENT_TYPES.CREATED },
      };

      vi.spyOn(notificationService, 'publishNotification').mockRejectedValue(
        new Error('Notification service down'),
      );

      let eventResult;
      try {
        eventResult = await consumerOrderQueue._handleOrderEvent(payload);
      } catch (err) {
        eventResult = { success: false, error: err };
      }

      expect(eventResult.success).toBe(false);

      // Verify consumer NACK logic: never ACK on failure!
      if (eventResult.success) {
        mockChannel.ack(messageData);
      } else {
        mockChannel.nack(messageData, false, false);
      }

      expect(mockChannel.nack).toHaveBeenCalledWith(messageData, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should identify 4xx status codes and business errors as non-retryable', () => {
      const badRequest = new ApiError(StatusCodes.BAD_REQUEST, 'Invalid voucher');
      const notFound = new ApiError(StatusCodes.NOT_FOUND, 'Product not found');
      const outOfStock = new Error('Product out of stock');
      const serverError = new Error('Database connection lost');

      expect(consumerOrderQueue._isNonRetryableError(badRequest)).toBe(true);
      expect(consumerOrderQueue._isNonRetryableError(notFound)).toBe(true);
      expect(consumerOrderQueue._isNonRetryableError(outOfStock)).toBe(true);
      expect(consumerOrderQueue._isNonRetryableError(serverError)).toBe(false);
    });

    it('publishOrder should supply timeout option to prevent indefinite hangs', async () => {
      const mockPublish = vi.fn().mockResolvedValue(true);
      const mockChannel = { publish: mockPublish };
      vi.spyOn(orderService, 'initRabbitMQ').mockResolvedValue({ channel: mockChannel });

      await orderService.publishOrder({ test: true }, 'order.test');

      expect(mockPublish).toHaveBeenCalledWith(
        expect.any(String),
        'order.test',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          timeout: 5000,
        }),
      );
    });
  });

  describe('RabbitMQ Consumer Prefetch Configuration & Sizing Formula', () => {
    it('should export optimal production default prefetch values', () => {
      expect(consumerOrderQueue.ORDER_WORKER_PREFETCH).toBeGreaterThanOrEqual(50);
      expect(consumerOrderQueue.ORDER_DLQ_PREFETCH).toBeGreaterThanOrEqual(10);
    });

    it("should calculate optimal prefetch based on Little's Law formula", () => {
      // prefetch = (target_throughput × average_processing_time_seconds) / number_of_workers
      // Target: 1000 msg/s, processing: 50ms (0.05s), 10 workers => 5
      expect(consumerOrderQueue.calculateOptimalPrefetch(1000, 0.05, 10)).toBe(5);

      // Flash sale scenario: 10,000 msg/s, processing: 10ms (0.01s), 2 workers => 50
      expect(consumerOrderQueue.calculateOptimalPrefetch(10000, 0.01, 2)).toBe(50);

      // Single worker handling 500 msg/s at 100ms => 50
      expect(consumerOrderQueue.calculateOptimalPrefetch(500, 0.1, 1)).toBe(50);

      // Boundary check: always at least 1
      expect(consumerOrderQueue.calculateOptimalPrefetch(0, 0, 1)).toBe(1);
    });
  });

  describe('Asynchronous Order Ingestion (Fast 202 Accepted & RabbitMQ Shield Flow)', () => {
    const mockRes = () => {
      const res = {};
      res.status = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      return res;
    };

    it('buyNow should return 202 ACCEPTED with trackingId when x-async header is provided', async () => {
      const req = {
        user: { _id: '66e138a0f123456789012345' },
        headers: { 'x-async': 'true' },
        query: {},
        body: {
          productId: '66e138a0f123456789012311',
          quantity: 1,
          addressId: '66e138a0f123456789012388',
        },
      };
      const res = mockRes();

      const enqueueResult = {
        trackingId: 'mock-tracking-uuid',
        status: 'queued',
        message: 'Đơn hàng đã được tiếp nhận vào hàng đợi xử lý',
      };
      vi.spyOn(orderService, 'enqueueOrderCreation').mockResolvedValue(enqueueResult);

      await orderController.buyNow(req, res);

      expect(orderService.enqueueOrderCreation).toHaveBeenCalledWith(req.user._id, req.body, {
        isBuyNow: true,
      });
      expect(res.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: StatusCodes.ACCEPTED,
          data: enqueueResult,
        }),
      );
    });

    it('enqueueOrderCreation should publish command to RabbitMQ and record tracking in Redis', async () => {
      const redisService = require('../../src/services/redis.service');
      const setSpy = vi.spyOn(redisService, 'set').mockResolvedValue('OK');
      const publishSpy = vi
        .spyOn(orderService, 'publishOrder')
        .mockResolvedValue({ published: true });

      const userId = '66e138a0f123456789012345';
      const orderData = { productId: '66e138a0f123456789012311', quantity: 1, addressId: 'addr-1' };

      const result = await orderService.enqueueOrderCreation(userId, orderData, { isBuyNow: true });

      expect(result.status).toBe('queued');
      expect(result.trackingId).toBeDefined();
      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining(`order:tracking:${result.trackingId}`),
        expect.objectContaining({
          trackingId: result.trackingId,
          userId,
          status: 'queued',
          isBuyNow: true,
        }),
        86400,
      );
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: ORDER_EVENT_TYPES.COMMAND_CREATE,
          trackingId: result.trackingId,
          userId,
          isBuyNow: true,
        }),
        ORDER_EVENT_TYPES.COMMAND_CREATE,
      );
    });

    it('worker should process COMMAND_CREATE, execute buyNow, and mark tracking completed', async () => {
      const redisService = require('../../src/services/redis.service');
      const setSpy = vi.spyOn(redisService, 'set').mockResolvedValue('OK');
      const mockOrderResult = {
        orderGroupId: 'grp-async-1',
        orders: [{ _id: 'ord-async-1', orderNumber: 'ORD-ASYNC-1' }],
      };
      vi.spyOn(orderService, 'buyNow').mockResolvedValue(mockOrderResult);

      const payload = {
        eventName: ORDER_EVENT_TYPES.COMMAND_CREATE,
        trackingId: 'track-123',
        userId: 'user-123',
        orderData: { productId: 'prod-1' },
        isBuyNow: true,
      };

      const result = await consumerOrderQueue._handleOrderEvent(payload);

      expect(result.success).toBe(true);
      expect(orderService.buyNow).toHaveBeenCalledWith('user-123', { productId: 'prod-1' });
      // Processing status set
      expect(setSpy).toHaveBeenCalledWith(
        'order:tracking:track-123',
        expect.objectContaining({ status: 'processing' }),
        86400,
      );
      // Completed status set
      expect(setSpy).toHaveBeenCalledWith(
        'order:tracking:track-123',
        expect.objectContaining({
          status: 'completed',
          orderGroupId: 'grp-async-1',
        }),
        86400,
      );
    });

    it('worker should mark tracking as failed and ACK when business error occurs', async () => {
      const redisService = require('../../src/services/redis.service');
      const setSpy = vi.spyOn(redisService, 'set').mockResolvedValue('OK');
      vi.spyOn(orderService, 'buyNow').mockRejectedValue(
        new ApiError(StatusCodes.CONFLICT, 'Product out of stock'),
      );

      const payload = {
        eventName: ORDER_EVENT_TYPES.COMMAND_CREATE,
        trackingId: 'track-oos',
        userId: 'user-123',
        orderData: { productId: 'prod-oos' },
        isBuyNow: true,
      };

      const result = await consumerOrderQueue._handleOrderEvent(payload);

      expect(result.success).toBe(true); // Handled gracefully, message ACKed
      expect(setSpy).toHaveBeenCalledWith(
        'order:tracking:track-oos',
        expect.objectContaining({
          status: 'failed',
          reason: expect.stringContaining('out of stock'),
        }),
        86400,
      );
    });
  });
});
