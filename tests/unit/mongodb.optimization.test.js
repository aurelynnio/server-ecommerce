/**
 * Real-module tests for MongoDB query & index optimizations:
 * - Mongoose aggregate() string -> ObjectId casting
 * - VoucherUsage partialFilterExpression (replacing broken compound sparse)
 * - Product schema index budget (<= 20) & ESR indexes
 * - ProductRepository._buildCatalogQuery using sizes instead of variants.size
 * - StatisticsService single-pass period aggregations
 * - VoucherService single-pass overview & merged usage lookup
 * - OutboxRepository ESR query & updateOneByFilter
 * - ReviewService empty-shop short-circuit & single-pass stats
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Types } = require('mongoose');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MongoDB Query & Index Optimizations (real modules)', () => {
  it('casts string IDs to Types.ObjectId in Notification, Message, and Review aggregations', async () => {
    const NotificationRepo = require('../../src/repositories/notification.repository');
    const { Message } = require('../../src/repositories/conversation.repository');
    const ReviewRepo = require('../../src/repositories/review.repository');

    const userIdStr = '507f1f77bcf86cd799439011';
    const convIdStr = '507f1f77bcf86cd799439012';
    const prodIdStr = '507f1f77bcf86cd799439013';

    const notifAgg = vi.spyOn(NotificationRepo, 'aggregateByPipeline').mockResolvedValue([]);
    await NotificationRepo.aggregateSummaryByUserId(userIdStr);
    expect(notifAgg.mock.calls[0][0][0].$match.userId).toBeInstanceOf(Types.ObjectId);

    const msgAgg = vi.spyOn(Message, 'aggregateByPipeline').mockResolvedValue([]);
    expect(await Message.aggregateUnreadCountsForUserByConversation(userIdStr, [])).toEqual([]);
    expect(msgAgg).not.toHaveBeenCalled();

    await Message.aggregateUnreadCountsForUserByConversation(userIdStr, [convIdStr]);
    const msgMatch = msgAgg.mock.calls[0][0][0].$match;
    expect(msgMatch.conversationId.$in[0]).toBeInstanceOf(Types.ObjectId);
    expect(msgMatch.senderId.$ne).toBeInstanceOf(Types.ObjectId);

    const revAgg = vi.spyOn(ReviewRepo, 'aggregateByPipeline').mockResolvedValue([]);
    await ReviewRepo.aggregateProductRatingStats(prodIdStr);
    expect(revAgg.mock.calls[0][0][0].$match.product).toBeInstanceOf(Types.ObjectId);
  });

  it('uses partialFilterExpression instead of compound sparse on VoucherUsage', () => {
    const VoucherUsage = require('../../src/models/voucher-usage.model');
    const indexes = VoucherUsage.schema.indexes();

    const orderUnique = indexes.find(([keys]) => keys.orderId === 1);
    const groupUnique = indexes.find(([keys]) => keys.orderGroupId === 1);
    const userVoucherIdx = indexes.find(
      ([keys]) => keys.userId === 1 && keys.voucherId === 1 && Object.keys(keys).length === 2,
    );

    expect(orderUnique[1].unique).toBe(true);
    expect(orderUnique[1].sparse).toBeUndefined();
    expect(orderUnique[1].partialFilterExpression).toEqual({ orderId: { $exists: true } });

    expect(groupUnique[1].unique).toBe(true);
    expect(groupUnique[1].sparse).toBeUndefined();
    expect(groupUnique[1].partialFilterExpression).toEqual({ orderGroupId: { $exists: true } });

    expect(userVoucherIdx).toBeDefined();
  });

  it('keeps Product schema index count <= 20 and removes redundant reverse price indexes', () => {
    const Product = require('../../src/models/product.model');
    const indexes = Product.schema.indexes();

    // +1 for implicit _id index
    expect(indexes.length + 1).toBeLessThanOrEqual(20);

    const hasRedundantPriceDesc = indexes.some(
      ([keys]) => keys.status === 1 && keys['price.currentPrice'] === -1 && !keys.category,
    );
    const hasRedundantCatPriceDesc = indexes.some(
      ([keys]) => keys.category === 1 && keys.status === 1 && keys['price.currentPrice'] === -1,
    );
    const hasLowStockPartial = indexes.some(
      ([keys, opts]) =>
        keys.stock === 1 && opts?.partialFilterExpression?.status === 'published',
    );

    expect(hasRedundantPriceDesc).toBe(false);
    expect(hasRedundantCatPriceDesc).toBe(false);
    expect(hasLowStockPartial).toBe(true);
  });

  it('ProductRepository._buildCatalogQuery filters by root sizes instead of non-existent variants.size', () => {
    const ProductRepo = require('../../src/repositories/product.repository');
    const query = ProductRepo._buildCatalogQuery({ sizes: 'M,L' });

    expect(query.sizes).toEqual({ $in: ['M', 'L'] });
    expect(query['variants.size']).toBeUndefined();
  });

  it('StatisticsService uses single-pass period aggregations for orders and users', async () => {
    const statisticsService = require('../../src/services/statistics.service');
    const OrderRepo = require('../../src/repositories/order.repository');
    const UserRepo = require('../../src/repositories/user.repository');
    const ProductRepo = require('../../src/repositories/product.repository');

    vi.spyOn(OrderRepo, 'aggregateRevenueAndOrderCount').mockResolvedValue([
      { totalRevenue: [{ total: 1000 }], totalOrders: [{ count: 5 }] },
    ]);
    vi.spyOn(UserRepo, 'countUsersByRole').mockResolvedValue(10);
    vi.spyOn(ProductRepo, 'countPublishedProducts').mockResolvedValue(20);
    vi.spyOn(OrderRepo, 'findRecentWithUser').mockResolvedValue([]);
    vi.spyOn(ProductRepo, 'findTopSellingProducts').mockResolvedValue([]);
    vi.spyOn(OrderRepo, 'aggregateMonthlyStatsLastMonths').mockResolvedValue([]);
    vi.spyOn(OrderRepo, 'aggregateDashboardPeriodStats').mockResolvedValue([
      {
        newOrdersToday: 2,
        revenueToday: 500,
        currentMonthOrders: 4,
        previousMonthOrders: 2,
        currentMonthRevenue: 800,
        previousMonthRevenue: 400,
      },
    ]);
    vi.spyOn(UserRepo, 'aggregateDashboardPeriodCounts').mockResolvedValue([
      { newUsersToday: 1, currentMonthUsers: 3, previousMonthUsers: 2 },
    ]);
    vi.spyOn(OrderRepo, 'countByStatus').mockResolvedValue(1);
    vi.spyOn(ProductRepo, 'countLowStockPublished').mockResolvedValue(3);

    const stats = await statisticsService.getDashboardStats();
    expect(stats.totalRevenue).toBe(1000);
    expect(stats.revenueToday).toBe(500);
    expect(stats.orderGrowth).toBe(100);
    expect(stats.userGrowth).toBe(50);
  });

  it('VoucherService uses single-pass aggregateVoucherOverview and merged usage lookup', async () => {
    const voucherService = require('../../src/services/voucher.service');
    const VoucherRepo = require('../../src/repositories/voucher.repository');
    const VoucherUsageRepo = require('../../src/repositories/voucher-usage.repository');

    const overviewSpy = vi.spyOn(VoucherRepo, 'aggregateVoucherOverview').mockResolvedValue([
      {
        totalVouchers: 10,
        activeVouchers: 6,
        expiredVouchers: 2,
        platformVouchers: 4,
        shopVouchers: 6,
        totalUsage: 42,
      },
    ]);
    vi.spyOn(VoucherRepo, 'findMostUsed').mockResolvedValue([]);

    const stats = await voucherService.getVoucherStatistics();
    expect(overviewSpy).toHaveBeenCalledTimes(1);
    expect(stats.totalVouchers).toBe(10);
    expect(stats.totalUsage).toBe(42);

    const pId = new Types.ObjectId();
    const sId = new Types.ObjectId();
    vi.spyOn(VoucherRepo, 'findAvailablePlatform').mockResolvedValue([
      { _id: pId, usageLimitPerUser: 1 },
    ]);
    vi.spyOn(VoucherRepo, 'findAvailableShop').mockResolvedValue([
      { _id: sId, usageLimitPerUser: 2 },
    ]);
    const usageSpy = vi
      .spyOn(VoucherUsageRepo, 'aggregateUsageByVoucherIdsAndUser')
      .mockResolvedValue([
        { _id: pId, count: 1 },
        { _id: sId, count: 1 },
      ]);

    const avail = await voucherService.getAvailableVouchers('507f1f77bcf86cd799439011', 'shop-1');
    expect(usageSpy).toHaveBeenCalledTimes(1);
    expect(avail.platform).toHaveLength(0);
    expect(avail.shop).toHaveLength(1);
  });

  it('OutboxRepository uses ESR-friendly nextRetryAt <= now query and updateOneByFilter', async () => {
    const outboxRepo = require('../../src/repositories/outbox.repository');
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ lean }));
    const sort = vi.fn(() => ({ limit }));
    const findSpy = vi.spyOn(outboxRepo.Model, 'find').mockReturnValue({ sort });

    await outboxRepo.findPendingEvents(25);
    expect(findSpy).toHaveBeenCalledWith({
      status: { $in: ['pending', 'failed'] },
      nextRetryAt: { $lte: expect.any(Date) },
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(limit).toHaveBeenCalledWith(25);

    const updSpy = vi.spyOn(outboxRepo, 'updateOneByFilter').mockResolvedValue({ modifiedCount: 1 });
    await outboxRepo.markPublished('ev-1');
    expect(updSpy).toHaveBeenCalledWith(
      { _id: 'ev-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'published' }) }),
    );
  });

  it('ReviewService short-circuits empty shop products and computes stats in one aggregation', async () => {
    const reviewService = require('../../src/services/review.service');
    const ProductRepo = require('../../src/repositories/product.repository');
    const ReviewRepo = require('../../src/repositories/review.repository');

    vi.spyOn(ProductRepo, 'findByShopIdSelectIds').mockResolvedValue([]);
    const countSpy = vi.spyOn(ReviewRepo, 'countByProductIdsWithFilters');
    const res = await reviewService.getReviewsByShopId('shop-empty', {});
    expect(countSpy).not.toHaveBeenCalled();
    expect(res.data).toEqual([]);

    vi.spyOn(ReviewRepo, 'aggregateOverallRatingDistribution').mockResolvedValue([
      { _id: 5, count: 2 },
      { _id: 4, count: 2 },
    ]);
    vi.spyOn(ProductRepo, 'findTopRatedProducts').mockResolvedValue([]);
    vi.spyOn(ProductRepo, 'findMostReviewedProducts').mockResolvedValue([]);

    const stats = await reviewService.getReviewStatistics();
    expect(stats.totalReviews).toBe(4);
    expect(stats.averageRating).toBe(4.5);
  });
});
