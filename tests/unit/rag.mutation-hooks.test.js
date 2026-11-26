import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventoryService = require('../../src/services/inventory.service');
const productRepository = require('../../src/repositories/product.repository');
const embeddingSyncService = require('../../src/services/embedding-sync.service');
const outboxService = require('../../src/services/outbox.service');

describe('RAG mutation hooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(productRepository, 'decrementStockForBaseSale').mockResolvedValue({ matchedCount: 1 });
    vi.spyOn(productRepository, 'restoreStockForBaseProduct').mockResolvedValue({ matchedCount: 1 });
    vi.spyOn(embeddingSyncService, 'scheduleProductsSync').mockResolvedValue(true);
  });

  it('writes the stock embedding event in the same deduct transaction session', async () => {
    const session = { id: 'session-1' };

    await inventoryService.deductStock([{ productId: 'p1', quantity: 2 }], session);

    expect(embeddingSyncService.scheduleProductsSync).toHaveBeenCalledWith(['p1'], {
      reason: 'stock_deducted',
      session,
    });
  });

  it('writes the stock embedding event in the same restore transaction session', async () => {
    const session = { id: 'session-2' };

    await inventoryService.restoreStock([{ productId: 'p1', quantity: 2 }], session);

    expect(embeddingSyncService.scheduleProductsSync).toHaveBeenCalledWith(['p1'], {
      reason: 'stock_restored',
      session,
    });
  });

  it('does not report stock mutation success when the outbox write rejects', async () => {
    const outboxError = new Error('outbox unavailable');
    embeddingSyncService.scheduleProductsSync.mockRejectedValue(outboxError);

    await expect(
      inventoryService.deductStock([{ productId: 'p1', quantity: 1 }], { id: 'session-3' }),
    ).rejects.toBe(outboxError);
  });

  it('keeps business writes resilient when embedding enqueue fails outside a transaction', async () => {
    vi.spyOn(outboxService, 'enqueueEvent').mockRejectedValue(new Error('mongo unavailable'));

    await expect(
      embeddingSyncService.scheduleProductSync('p1', { reason: 'product_updated' }),
    ).resolves.toBe(false);
  });
});
