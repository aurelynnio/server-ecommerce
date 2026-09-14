import { describe, it, expect, vi, beforeEach } from 'vitest';
const outboxService = require('../../src/services/outbox.service');
const outboxRepository = require('../../src/repositories/outbox.repository');
const orderService = require('../../src/services/order.service');

describe('Outbox Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboxService._isDispatching = false;
  });

  describe('enqueueEvent', () => {
    it('should delegate to outboxRepository.createEvent', async () => {
      const mockEvent = {
        _id: 'outbox123',
        eventType: 'order.created',
        routingKey: 'order.created',
        payload: { orderId: 'ord1' },
        status: 'pending',
      };

      const spy = vi.spyOn(outboxRepository, 'createEvent').mockResolvedValue(mockEvent);

      const result = await outboxService.enqueueEvent({
        eventType: 'order.created',
        routingKey: 'order.created',
        payload: { orderId: 'ord1' },
      });

      expect(spy).toHaveBeenCalledWith(
        {
          eventType: 'order.created',
          routingKey: 'order.created',
          payload: { orderId: 'ord1' },
        },
        { session: null },
      );
      expect(result._id).toBe('outbox123');
    });

    it('should pass mongoose session when provided', async () => {
      const mockSession = { id: 'session123' };
      const spy = vi.spyOn(outboxRepository, 'createEvent').mockResolvedValue({ _id: 'outbox456' });

      await outboxService.enqueueEvent(
        {
          eventType: 'order.created',
          routingKey: 'order.created',
          payload: { orderId: 'ord2' },
        },
        { session: mockSession },
      );

      expect(spy).toHaveBeenCalledWith(expect.any(Object), { session: mockSession });
    });
  });

  describe('enqueueEvents', () => {
    it('should return empty array when events is empty or not an array', async () => {
      expect(await outboxService.enqueueEvents([])).toEqual([]);
      expect(await outboxService.enqueueEvents(null)).toEqual([]);
    });

    it('should delegate to outboxRepository.insertEvents', async () => {
      const mockInserted = [
        { _id: '1', eventType: 'order.created' },
        { _id: '2', eventType: 'order.created' },
      ];
      const spy = vi.spyOn(outboxRepository, 'insertEvents').mockResolvedValue(mockInserted);

      const events = [
        { eventType: 'order.created', routingKey: 'order.created', payload: { id: 1 } },
        { eventType: 'order.created', routingKey: 'order.created', payload: { id: 2 } },
      ];

      const res = await outboxService.enqueueEvents(events);
      expect(res).toHaveLength(2);
      expect(spy).toHaveBeenCalledWith(events, { session: null });
    });
  });

  describe('dispatchPendingEvents', () => {
    it('should return zeros when no pending events', async () => {
      vi.spyOn(outboxRepository, 'findPendingEvents').mockResolvedValue([]);

      const result = await outboxService.dispatchPendingEvents();
      expect(result).toEqual({ processed: 0, published: 0, failed: 0 });
    });

    it('should publish each pending event and mark as published', async () => {
      const pendingEvents = [
        {
          _id: 'ev1',
          eventType: 'order.created',
          routingKey: 'order.created',
          payload: { orderId: '101' },
          retryCount: 0,
        },
        {
          _id: 'ev2',
          eventType: 'order.created',
          routingKey: 'order.created',
          payload: { orderId: '102' },
          retryCount: 0,
        },
      ];

      vi.spyOn(outboxRepository, 'findPendingEvents').mockResolvedValue(pendingEvents);
      const publishSpy = vi.spyOn(orderService, 'publishOrder').mockResolvedValue(true);
      const markPublishedSpy = vi.spyOn(outboxRepository, 'markPublished').mockResolvedValue(true);

      const result = await outboxService.dispatchPendingEvents();

      expect(result.processed).toBe(2);
      expect(result.published).toBe(2);
      expect(result.failed).toBe(0);
      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(markPublishedSpy).toHaveBeenCalledWith('ev1');
      expect(markPublishedSpy).toHaveBeenCalledWith('ev2');
    });

    it('should handle publish failures, increment retryCount, and mark failed with backoff', async () => {
      const pendingEvents = [
        {
          _id: 'ev_fail',
          eventType: 'order.created',
          routingKey: 'order.created',
          payload: { orderId: '999' },
          retryCount: 1,
          maxRetries: 5,
        },
      ];

      vi.spyOn(outboxRepository, 'findPendingEvents').mockResolvedValue(pendingEvents);
      vi.spyOn(orderService, 'publishOrder').mockRejectedValue(new Error('Broker unavailable'));
      const markFailedSpy = vi.spyOn(outboxRepository, 'markFailed').mockResolvedValue(true);

      const result = await outboxService.dispatchPendingEvents();

      expect(result.processed).toBe(1);
      expect(result.published).toBe(0);
      expect(result.failed).toBe(1);
      expect(markFailedSpy).toHaveBeenCalledWith(
        'ev_fail',
        'Broker unavailable',
        2, // nextRetryCount
        expect.any(Date),
        false, // not dead letter yet
      );
    });

    it('should mark as dead_letter when retryCount reaches maxRetries', async () => {
      const pendingEvents = [
        {
          _id: 'ev_dead',
          eventType: 'order.created',
          routingKey: 'order.created',
          payload: { orderId: '888' },
          retryCount: 4,
          maxRetries: 5,
        },
      ];

      vi.spyOn(outboxRepository, 'findPendingEvents').mockResolvedValue(pendingEvents);
      vi.spyOn(orderService, 'publishOrder').mockRejectedValue(new Error('Broker unreachable'));
      const markFailedSpy = vi.spyOn(outboxRepository, 'markFailed').mockResolvedValue(true);

      const result = await outboxService.dispatchPendingEvents();

      expect(result.failed).toBe(1);
      expect(markFailedSpy).toHaveBeenCalledWith(
        'ev_dead',
        'Broker unreachable',
        5,
        null, // dead letter has null nextRetryAt
        true, // isDeadLetter = true
      );
    });

    it('should prevent overlapping executions with isDispatching guard', async () => {
      outboxService._isDispatching = true;
      const result = await outboxService.dispatchPendingEvents();
      expect(result).toEqual({ skipped: true });
    });
  });
});
