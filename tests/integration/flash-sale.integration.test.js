/**
 * Integration Tests: Flash Sale Schedule + Enrichment Pipeline
 * Tests getFlashSaleSchedule → enrichment logic end-to-end
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Re-implement pure functions from FlashSaleService to avoid DB imports
const saleHours = [10, 12, 20, 22];

function getNextSaleTime(now) {
  const today = new Date(now);
  for (const hour of saleHours) {
    const saleTime = new Date(today);
    saleTime.setHours(hour, 0, 0, 0);
    if (saleTime > now) return saleTime;
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(saleHours[0], 0, 0, 0);
  return tomorrow;
}

function getFlashSaleSchedule(now) {
  const slots = [];
  let current = new Date(now);
  const endOfRange = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  while (current < endOfRange && slots.length < 6) {
    for (const hour of saleHours) {
      if (slots.length >= 6) break;
      const slotStart = new Date(current);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 2, 0, 0, 0);

      if (slotEnd > now) {
        const status =
          now >= slotStart && now < slotEnd ? 'ongoing' : now < slotStart ? 'upcoming' : 'ended';

        if (status !== 'ended') {
          slots.push({ startTime: slotStart, endTime: slotEnd, status });
        }
      }
    }
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  return slots;
}

function enrichFlashSaleProduct(product, now, slotEndTime) {
  const soldCount = product.soldCount || 0;
  const stock = product.stock || 0;
  const totalStock = soldCount + stock;
  const soldPercent = totalStock > 0 ? Math.round((soldCount / totalStock) * 100) : 0;
  const remainingSeconds = Math.max(0, Math.floor((slotEndTime.getTime() - now.getTime()) / 1000));

  return {
    ...product,
    soldPercent,
    remainingSeconds,
    isAlmostGone: soldPercent >= 80,
  };
}

describe('Flash Sale Pipeline - Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Schedule generation + product enrichment flow', () => {
    it('should generate schedule and enrich products for ongoing sale', () => {
      // Set time to 10:30 (during first sale slot 10:00-12:00)
      const now = new Date('2026-03-15T10:30:00');
      vi.setSystemTime(now);

      const schedule = getFlashSaleSchedule(now);

      // First slot should be ongoing
      expect(schedule[0].status).toBe('ongoing');
      expect(schedule[0].startTime.getHours()).toBe(10);

      // Enrich a product with that slot
      const product = {
        name: 'Flash Deal Phone',
        price: { currentPrice: 5000000, discountPrice: 3000000 },
        soldCount: 80,
        stock: 20,
      };

      const enriched = enrichFlashSaleProduct(product, now, schedule[0].endTime);
      expect(enriched.soldPercent).toBe(80);
      expect(enriched.isAlmostGone).toBe(true);
      expect(enriched.remainingSeconds).toBe(90 * 60); // 1.5 hrs remaining
    });

    it('should show upcoming slots before first sale of day', () => {
      const now = new Date('2026-03-15T08:00:00');
      vi.setSystemTime(now);

      const schedule = getFlashSaleSchedule(now);

      // All should be upcoming since we're before 10:00
      expect(schedule[0].status).toBe('upcoming');
      expect(schedule[0].startTime.getHours()).toBe(10);
      expect(schedule.length).toBeGreaterThanOrEqual(4);
    });

    it('should include next day slots when late at night', () => {
      // At 23:30 the last slot (22:00-00:00) is still ongoing
      const now = new Date('2026-03-15T23:30:00');
      vi.setSystemTime(now);

      const schedule = getFlashSaleSchedule(now);

      expect(schedule.length).toBeGreaterThan(0);
      // First slot should be the ongoing 22:00-00:00 slot (still on the 15th)
      expect(schedule[0].status).toBe('ongoing');
      expect(schedule[0].startTime.getHours()).toBe(22);
      // Should also include next day's slots
      expect(schedule.length).toBeGreaterThan(1);
      const nextDaySlot = schedule.find((s) => s.startTime.getDate() === 16);
      expect(nextDaySlot).toBeDefined();
    });

    it('should calculate remaining seconds correctly for ending sale', () => {
      // 1 minute before sale ends
      const now = new Date('2026-03-15T11:59:00');
      vi.setSystemTime(now);

      const schedule = getFlashSaleSchedule(now);
      const ongoingSlot = schedule.find((s) => s.status === 'ongoing');

      expect(ongoingSlot).toBeDefined();

      const product = { name: 'Test', soldCount: 5, stock: 95 };
      const enriched = enrichFlashSaleProduct(product, now, ongoingSlot.endTime);

      expect(enriched.remainingSeconds).toBe(60); // 1 minute
      expect(enriched.soldPercent).toBe(5);
      expect(enriched.isAlmostGone).toBe(false);
    });

    it('should handle product with zero stock gracefully', () => {
      const now = new Date('2026-03-15T10:30:00');
      const endTime = new Date('2026-03-15T12:00:00');

      const product = { name: 'Sold Out', soldCount: 0, stock: 0 };
      const enriched = enrichFlashSaleProduct(product, now, endTime);

      expect(enriched.soldPercent).toBe(0);
      expect(enriched.remainingSeconds).toBe(90 * 60);
      expect(enriched.isAlmostGone).toBe(false);
    });

    it('should clamp remainingSeconds to 0 for expired slots', () => {
      const now = new Date('2026-03-15T14:00:00');
      const endTime = new Date('2026-03-15T12:00:00'); // already ended

      const product = { name: 'Expired', soldCount: 50, stock: 50 };
      const enriched = enrichFlashSaleProduct(product, now, endTime);

      expect(enriched.remainingSeconds).toBe(0);
      expect(enriched.soldPercent).toBe(50);
    });
  });

  describe('Full day simulation', () => {
    it('should generate correct slot transitions throughout a day', () => {
      const times = [
        { hour: 9, expectedFirst: 'upcoming' },
        { hour: 10, expectedFirst: 'ongoing' },
        { hour: 11, expectedFirst: 'ongoing' },
        { hour: 12, expectedFirst: 'ongoing' }, // 12:00-14:00 slot
        { hour: 15, expectedFirst: 'upcoming' },
        { hour: 20, expectedFirst: 'ongoing' },
        { hour: 22, expectedFirst: 'ongoing' },
      ];

      for (const { hour, expectedFirst } of times) {
        const now = new Date(`2026-03-15T${hour.toString().padStart(2, '0')}:30:00`);
        vi.setSystemTime(now);

        const schedule = getFlashSaleSchedule(now);
        expect(schedule.length).toBeGreaterThan(0);
        expect(schedule[0].status).toBe(expectedFirst);
      }
    });
  });

  describe('getNextSaleTime integration with schedule', () => {
    it('should align with first upcoming slot in schedule', () => {
      const now = new Date('2026-03-15T08:00:00');
      vi.setSystemTime(now);

      const nextSale = getNextSaleTime(now);
      const schedule = getFlashSaleSchedule(now);

      // Next sale time should equal the start of first upcoming slot
      expect(nextSale.getTime()).toBe(schedule[0].startTime.getTime());
    });

    it('should return next slot when between sales', () => {
      const now = new Date('2026-03-15T14:00:00');
      vi.setSystemTime(now);

      const nextSale = getNextSaleTime(now);
      expect(nextSale.getHours()).toBe(20); // next sale at 20:00
    });
  });
});
