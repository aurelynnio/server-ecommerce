import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const schedulerService = require('../../src/services/scheduler.service');
const orderService = require('../../src/services/order.service');

describe('Scheduler Service', () => {
  beforeEach(() => {
    schedulerService.stopScheduler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    schedulerService.stopScheduler();
  });

  describe('runExpiredOrderCleanup', () => {
    it('should invoke orderService.cancelExpiredUnpaidOrders and return cancelled count', async () => {
      const cancelSpy = vi.spyOn(orderService, 'cancelExpiredUnpaidOrders').mockResolvedValue(3);

      const count = await schedulerService.runExpiredOrderCleanup(20);

      expect(cancelSpy).toHaveBeenCalledWith(20);
      expect(count).toBe(3);
    });

    it('should skip if another cleanup is already running', async () => {
      let resolveFirst;
      const firstCallPromise = new Promise((res) => {
        resolveFirst = res;
      });

      vi.spyOn(orderService, 'cancelExpiredUnpaidOrders').mockImplementation(
        () => firstCallPromise,
      );

      const p1 = schedulerService.runExpiredOrderCleanup();
      const p2 = schedulerService.runExpiredOrderCleanup();

      const [res1, res2] = await Promise.all([
        (async () => {
          resolveFirst(5);
          return p1;
        })(),
        p2,
      ]);

      expect(res1).toBe(5);
      expect(res2).toBe(0); // second call skipped
    });

    it('should catch errors and return 0 without throwing', async () => {
      vi.spyOn(orderService, 'cancelExpiredUnpaidOrders').mockRejectedValue(
        new Error('DB connection failed'),
      );

      const count = await schedulerService.runExpiredOrderCleanup();
      expect(count).toBe(0);
    });
  });

  describe('runOutboxDispatch', () => {
    it('should invoke outboxService.dispatchPendingEvents and return result', async () => {
      const outboxService = require('../../src/services/outbox.service');
      const dispatchSpy = vi
        .spyOn(outboxService, 'dispatchPendingEvents')
        .mockResolvedValue({ processed: 2, published: 2, failed: 0 });

      const result = await schedulerService.runOutboxDispatch();

      expect(dispatchSpy).toHaveBeenCalled();
      expect(result).toEqual({ processed: 2, published: 2, failed: 0 });
    });

    it('should skip if another outbox dispatch is already running', async () => {
      schedulerService._isDispatchingOutbox = true;
      const result = await schedulerService.runOutboxDispatch();
      expect(result).toEqual({ skipped: true });
    });
  });

  describe('startScheduler and stopScheduler lifecycle', () => {
    it('should toggle scheduler running state correctly', () => {
      expect(schedulerService.isSchedulerRunning()).toBe(false);

      schedulerService.startScheduler({
        orderExpiryIntervalMs: 60000,
        outboxDispatchIntervalMs: 5000,
      });
      expect(schedulerService.isSchedulerRunning()).toBe(true);

      // Subsequent start call should be idempotent
      schedulerService.startScheduler();
      expect(schedulerService.isSchedulerRunning()).toBe(true);

      schedulerService.stopScheduler();
      expect(schedulerService.isSchedulerRunning()).toBe(false);

      // Stop call when stopped should be safe
      schedulerService.stopScheduler();
      expect(schedulerService.isSchedulerRunning()).toBe(false);
    });
  });
});
