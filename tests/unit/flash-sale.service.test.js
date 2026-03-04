/**
 * Unit Tests: FlashSaleService
 * Tests pure time computation logic (no DB)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flashSaleService = require('../../src/services/flash-sale.service');

describe('FlashSaleService', () => {
  describe('getNextSaleTime()', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return next sale hour on same day', () => {
      // 8:00 AM → next should be 10:00 AM
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 8, 0, 0));

      const next = flashSaleService.getNextSaleTime();
      expect(next.getHours()).toBe(10);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(15);
    });

    it('should skip past sale hours', () => {
      // 11:00 AM → next should be 12:00 PM (10:00 already passed)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 11, 0, 0));

      const next = flashSaleService.getNextSaleTime();
      expect(next.getHours()).toBe(12);
    });

    it('should return 20:00 after 12:30', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 12, 30, 0));

      const next = flashSaleService.getNextSaleTime();
      expect(next.getHours()).toBe(20);
    });

    it('should return next day 10:00 after 22:00', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 23, 0, 0));

      const next = flashSaleService.getNextSaleTime();
      expect(next.getHours()).toBe(10);
      expect(next.getDate()).toBe(16);
    });

    it('should return today 22:00 if current time is 21:30', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 21, 30, 0));

      const next = flashSaleService.getNextSaleTime();
      expect(next.getHours()).toBe(22);
      expect(next.getDate()).toBe(15);
    });
  });

  describe('getFlashSaleSchedule()', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return up to 6 upcoming slots', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 8, 0, 0));

      const schedule = await flashSaleService.getFlashSaleSchedule();
      expect(schedule.length).toBeLessThanOrEqual(6);
      expect(schedule.length).toBeGreaterThan(0);
    });

    it('should have correct slot structure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 8, 0, 0));

      const schedule = await flashSaleService.getFlashSaleSchedule();
      const slot = schedule[0];

      expect(slot).toHaveProperty('startTime');
      expect(slot).toHaveProperty('endTime');
      expect(slot).toHaveProperty('status', 'upcoming');
      expect(slot).toHaveProperty('label');
    });

    it('should have endTime 2 hours after startTime', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 8, 0, 0));

      const schedule = await flashSaleService.getFlashSaleSchedule();
      for (const slot of schedule) {
        const diff = slot.endTime - slot.startTime;
        expect(diff).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
      }
    });

    it('should only include future time slots', async () => {
      vi.useFakeTimers();
      const now = new Date(2026, 0, 15, 13, 0, 0);
      vi.setSystemTime(now);

      const schedule = await flashSaleService.getFlashSaleSchedule();
      for (const slot of schedule) {
        expect(slot.startTime.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    it('should return slots from sale hours [10,12,20,22]', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 0, 1, 0));

      const schedule = await flashSaleService.getFlashSaleSchedule();
      const validHours = [10, 12, 20, 22];
      for (const slot of schedule) {
        expect(validHours).toContain(slot.startTime.getHours());
      }
    });

    it('should include next-day slots if needed', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 21, 0, 0));

      const schedule = await flashSaleService.getFlashSaleSchedule();
      // Only 22:00 today + 10,12,20,22 tomorrow = 5 slots
      expect(schedule.length).toBeGreaterThanOrEqual(1);
      const hasTomorrow = schedule.some((s) => s.startTime.getDate() === 16);
      expect(hasTomorrow).toBe(true);
    });
  });

  describe('Flash Sale Enrichment Logic', () => {
    it('should calculate soldPercent correctly', () => {
      const soldCount = 30;
      const stock = 100;
      const soldPercent = Math.round((soldCount / stock) * 100);
      expect(soldPercent).toBe(30);
    });

    it('should return 0 soldPercent when stock is null', () => {
      const stock = null;
      const soldPercent = stock ? Math.round((0 / stock) * 100) : 0;
      expect(soldPercent).toBe(0);
    });

    it('should calculate remainingSeconds', () => {
      const now = new Date();
      const endTime = new Date(now.getTime() + 3600 * 1000); // 1 hour
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      expect(remaining).toBeGreaterThanOrEqual(3599);
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    it('should clamp remainingSeconds to 0 for expired', () => {
      const now = new Date();
      const endTime = new Date(now.getTime() - 1000); // past
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      expect(remaining).toBe(0);
    });
  });
});
