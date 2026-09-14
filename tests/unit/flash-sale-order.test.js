import { describe, it, expect, vi, beforeEach } from 'vitest';
const Product = require('../../src/repositories/product.repository');
const inventoryService = require('../../src/services/inventory.service');
const orderService = require('../../src/services/order.service');
const ProductModel = require('../../src/models/product.model');
const { StatusCodes } = require('http-status-codes');

describe('Flash Sale Ordering & Stock Deduction Logic', () => {
  describe('Product Model Virtuals: onSale & effectivePrice with Quota', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
    const oneHourLater = new Date(now.getTime() + 3600 * 1000);

    it('should return flash sale price when active, in window, and quota available', () => {
      const product = new ProductModel({
        name: 'Test Flash Sale Product',
        slug: 'test-flash-sale-product',
        price: { currentPrice: 500000, discountPrice: 450000 },
        stock: 50,
        flashSale: {
          isActive: true,
          salePrice: 299000,
          stock: 10,
          soldCount: 3,
          startTime: oneHourAgo,
          endTime: oneHourLater,
        },
      });

      expect(product.onSale).toBe(true);
      expect(product.effectivePrice).toBe(299000);
    });

    it('should revert to standard price when flash sale quota is exhausted (soldCount >= stock)', () => {
      const product = new ProductModel({
        name: 'Exhausted Flash Sale Product',
        slug: 'exhausted-flash-sale-product',
        price: { currentPrice: 500000, discountPrice: 450000 },
        stock: 50,
        flashSale: {
          isActive: true,
          salePrice: 299000,
          stock: 10,
          soldCount: 10, // All 10 sold!
          startTime: oneHourAgo,
          endTime: oneHourLater,
        },
      });

      expect(product.onSale).toBe(true); // discountPrice < currentPrice is true
      expect(product.effectivePrice).toBe(450000); // Reverted to discountPrice instead of salePrice
    });

    it('should revert to standard price when flash sale has expired', () => {
      const twoHoursAgo = new Date(now.getTime() - 7200 * 1000);
      const product = new ProductModel({
        name: 'Expired Flash Sale Product',
        slug: 'expired-flash-sale-product',
        price: { currentPrice: 500000 },
        stock: 50,
        flashSale: {
          isActive: true,
          salePrice: 299000,
          stock: 10,
          soldCount: 2,
          startTime: twoHoursAgo,
          endTime: oneHourAgo, // Ended
        },
      });

      expect(product.onSale).toBe(false);
      expect(product.effectivePrice).toBe(500000);
    });
  });

  describe('InventoryService Flash Sale Handling', () => {
    it('aggregateItems() should preserve isFlashSale flag', () => {
      const items = [
        { productId: 'p1', modelId: 'v1', quantity: 2, isFlashSale: true },
        { productId: 'p1', modelId: 'v1', quantity: 1, isFlashSale: true },
        { productId: 'p1', modelId: 'v1', quantity: 1, isFlashSale: false },
      ];

      const aggregated = inventoryService.aggregateItems(items);
      expect(aggregated).toHaveLength(2);

      const flashSaleItem = aggregated.find((i) => i.isFlashSale);
      const normalItem = aggregated.find((i) => !i.isFlashSale);

      expect(flashSaleItem.quantity).toBe(3);
      expect(normalItem.quantity).toBe(1);
    });

    it('checkStockAvailability() should reject if flash sale quota exceeded', async () => {
      const now = new Date();
      const mockProduct = {
        _id: 'prod123',
        name: 'Flash Sale Phone',
        status: 'published',
        stock: 100,
        flashSale: {
          isActive: true,
          stock: 5,
          soldCount: 4, // Only 1 remaining in quota!
          startTime: new Date(now.getTime() - 1000),
          endTime: new Date(now.getTime() + 100000),
        },
        variants: [],
      };

      vi.spyOn(Product, 'findByIds').mockResolvedValue([mockProduct]);

      // Requesting 2 items when only 1 remaining in quota
      await expect(
        inventoryService.checkStockAvailability([
          { productId: 'prod123', modelId: null, quantity: 2, isFlashSale: true },
        ]),
      ).rejects.toThrow(/Flash sale quota exceeded/);

      Product.findByIds.mockRestore();
    });

    it('checkStockAvailability() should pass if flash sale quota has enough items', async () => {
      const now = new Date();
      const mockProduct = {
        _id: 'prod123',
        name: 'Flash Sale Phone',
        status: 'published',
        stock: 100,
        flashSale: {
          isActive: true,
          stock: 10,
          soldCount: 3, // 7 remaining
          startTime: new Date(now.getTime() - 1000),
          endTime: new Date(now.getTime() + 100000),
        },
        variants: [],
      };

      vi.spyOn(Product, 'findByIds').mockResolvedValue([mockProduct]);

      const result = await inventoryService.checkStockAvailability([
        { productId: 'prod123', modelId: null, quantity: 2, isFlashSale: true },
      ]);

      expect(result).toBe(true);
      Product.findByIds.mockRestore();
    });

    it('deductStock() should invoke decrementStockForBaseFlashSale for flash sale items', async () => {
      const decrementSpy = vi
        .spyOn(Product, 'decrementStockForBaseFlashSale')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      await inventoryService.deductStock(
        [{ productId: 'prod123', modelId: null, quantity: 2, isFlashSale: true }],
        {},
      );

      expect(decrementSpy).toHaveBeenCalledWith('prod123', 2, {});
      decrementSpy.mockRestore();
    });

    it('restoreStock() should invoke restoreStockForBaseFlashSale for flash sale items', async () => {
      const restoreSpy = vi
        .spyOn(Product, 'restoreStockForBaseFlashSale')
        .mockResolvedValue({ matchedCount: 1 });

      await inventoryService.restoreStock(
        [{ productId: 'prod123', modelId: null, quantity: 2, isFlashSale: true }],
        null,
      );

      expect(restoreSpy).toHaveBeenCalledWith('prod123', 2, {});
      restoreSpy.mockRestore();
    });
  });

  describe('OrderService restoreOrderStock', () => {
    it('should propagate isFlashSale to inventoryService.restoreStock', async () => {
      const restoreStockSpy = vi.spyOn(inventoryService, 'restoreStock').mockResolvedValue();

      const mockOrder = {
        products: [
          {
            productId: 'p1',
            variantId: 'v1',
            quantity: 2,
            isFlashSale: true,
          },
          {
            productId: 'p2',
            variantId: null,
            quantity: 1,
            isFlashSale: false,
          },
        ],
      };

      await orderService.restoreOrderStock(mockOrder, null);

      expect(restoreStockSpy).toHaveBeenCalledWith(
        [
          { productId: 'p1', modelId: 'v1', quantity: 2, isFlashSale: true },
          { productId: 'p2', modelId: null, quantity: 1 },
        ],
        null,
      );

      restoreStockSpy.mockRestore();
    });
  });
});
