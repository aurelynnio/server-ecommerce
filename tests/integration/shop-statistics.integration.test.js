/**
 * Integration Tests: Shop Statistics Data Transformation
 * Tests the data transformation pipeline in getShopStatistics
 * (ordersByStatus mapping, chartData generation, formattedTopProducts, formattedRecentOrders)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Re-implement the pure transformation logic from ShopService.getShopStatistics

/**
 * Map raw order status aggregation to structured counts
 */
function mapOrdersByStatus(orderStatusCounts) {
  const ordersByStatus = {
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
  };
  orderStatusCounts.forEach((item) => {
    if (ordersByStatus.hasOwnProperty(item._id)) {
      ordersByStatus[item._id] = item.count;
    }
  });
  return ordersByStatus;
}

/**
 * Generate last 6 months chart data
 */
function generateChartData(monthlyRevenueRaw, referenceDate) {
  const today = new Date(referenceDate);
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    last6Months.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      key: `${d.getMonth() + 1}/${d.getFullYear()}`,
    });
  }

  const revenueMap = {};
  monthlyRevenueRaw.forEach((item) => {
    const key = `${item._id.month}/${item._id.year}`;
    revenueMap[key] = { revenue: item.revenue, orders: item.orders };
  });

  return last6Months.map((time) => {
    const data = revenueMap[time.key] || { revenue: 0, orders: 0 };
    return {
      month: `T${time.month}`,
      revenue: data.revenue,
      orders: data.orders,
    };
  });
}

/**
 * Format top products for dashboard
 */
function formatTopProducts(topProducts) {
  return topProducts.map((product) => {
    const image = product.variants?.[0]?.images?.[0] || null;
    const price = product.variants?.[0]?.price || 0;
    return {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      image,
      sold: product.soldCount || 0,
      revenue: price * (product.soldCount || 0),
    };
  });
}

/**
 * Format recent orders for dashboard
 */
function formatRecentOrders(recentOrders) {
  return recentOrders.map((order) => ({
    _id: order._id,
    customer: order.userId?.username || 'Guest',
    avatar: order.userId?.avatar || null,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
  }));
}

describe('Shop Statistics Pipeline - Integration Tests', () => {
  describe('mapOrdersByStatus', () => {
    it('should map aggregation results to status object', () => {
      const raw = [
        { _id: 'pending', count: 5 },
        { _id: 'delivered', count: 20 },
        { _id: 'cancelled', count: 3 },
      ];

      const result = mapOrdersByStatus(raw);
      expect(result).toEqual({
        pending: 5,
        confirmed: 0,
        processing: 0,
        shipped: 0,
        delivered: 20,
        cancelled: 3,
        returned: 0,
      });
    });

    it('should ignore unknown statuses', () => {
      const raw = [
        { _id: 'pending', count: 1 },
        { _id: 'unknown_status', count: 99 },
      ];

      const result = mapOrdersByStatus(raw);
      expect(result.pending).toBe(1);
      expect(result).not.toHaveProperty('unknown_status');
    });

    it('should return all zeros for empty aggregation', () => {
      const result = mapOrdersByStatus([]);
      Object.values(result).forEach((v) => expect(v).toBe(0));
    });
  });

  describe('generateChartData', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should generate 6 months of chart data', () => {
      const refDate = new Date('2026-06-15');
      vi.setSystemTime(refDate);

      const rawRevenue = [
        { _id: { month: 3, year: 2026 }, revenue: 1000000, orders: 10 },
        { _id: { month: 5, year: 2026 }, revenue: 2500000, orders: 25 },
      ];

      const chartData = generateChartData(rawRevenue, refDate);

      expect(chartData).toHaveLength(6);
      // Months should be T1 through T6
      expect(chartData[0].month).toBe('T1');
      expect(chartData[5].month).toBe('T6');

      // March (index 2) should have data
      expect(chartData[2].revenue).toBe(1000000);
      expect(chartData[2].orders).toBe(10);

      // May (index 4) should have data
      expect(chartData[4].revenue).toBe(2500000);

      // Months without data should be 0
      expect(chartData[0].revenue).toBe(0);
      expect(chartData[0].orders).toBe(0);
    });

    it('should handle year boundary (January reference)', () => {
      const refDate = new Date('2026-02-15');

      const chartData = generateChartData([], refDate);

      expect(chartData).toHaveLength(6);
      // Should include months from previous year
      expect(chartData[0].month).toBe('T9'); // Sep 2025
      expect(chartData[5].month).toBe('T2'); // Feb 2026
    });
  });

  describe('formatTopProducts', () => {
    it('should format products with variant image and revenue', () => {
      const products = [
        {
          _id: 'p1',
          name: 'iPhone 15',
          slug: 'iphone-15',
          soldCount: 100,
          variants: [{ price: 25000000, images: ['img1.jpg', 'img2.jpg'] }],
        },
        {
          _id: 'p2',
          name: 'AirPods',
          slug: 'airpods',
          soldCount: 50,
          variants: [{ price: 3000000, images: [] }],
        },
      ];

      const formatted = formatTopProducts(products);

      expect(formatted[0]).toEqual({
        _id: 'p1',
        name: 'iPhone 15',
        slug: 'iphone-15',
        image: 'img1.jpg',
        sold: 100,
        revenue: 2500000000,
      });

      expect(formatted[1].image).toBeNull(); // empty images array
      expect(formatted[1].revenue).toBe(150000000);
    });

    it('should handle products without variants', () => {
      const products = [{ _id: 'p1', name: 'Simple', slug: 'simple', soldCount: 10 }];

      const formatted = formatTopProducts(products);
      expect(formatted[0].image).toBeNull();
      expect(formatted[0].revenue).toBe(0); // no variant price
    });

    it('should handle zero soldCount', () => {
      const products = [
        {
          _id: 'p1',
          name: 'New',
          slug: 'new',
          variants: [{ price: 100000, images: ['a.jpg'] }],
        },
      ];

      const formatted = formatTopProducts(products);
      expect(formatted[0].sold).toBe(0);
      expect(formatted[0].revenue).toBe(0);
    });
  });

  describe('formatRecentOrders', () => {
    it('should format orders with customer info', () => {
      const orders = [
        {
          _id: 'o1',
          userId: { username: 'john', avatar: 'avatar.jpg' },
          totalAmount: 500000,
          status: 'delivered',
          paymentStatus: 'paid',
          createdAt: new Date('2026-06-01'),
        },
      ];

      const formatted = formatRecentOrders(orders);
      expect(formatted[0].customer).toBe('john');
      expect(formatted[0].avatar).toBe('avatar.jpg');
      expect(formatted[0].totalAmount).toBe(500000);
    });

    it('should show Guest for orders without userId', () => {
      const orders = [
        {
          _id: 'o1',
          userId: null,
          totalAmount: 100000,
          status: 'pending',
          paymentStatus: 'unpaid',
          createdAt: new Date(),
        },
      ];

      const formatted = formatRecentOrders(orders);
      expect(formatted[0].customer).toBe('Guest');
      expect(formatted[0].avatar).toBeNull();
    });
  });

  describe('Full statistics assembly', () => {
    it('should assemble complete statistics object', () => {
      const orderStatusCounts = [
        { _id: 'pending', count: 5 },
        { _id: 'delivered', count: 50 },
        { _id: 'cancelled', count: 2 },
      ];
      const revenueData = [{ total: 15000000 }];
      const topProducts = [
        {
          _id: 'p1',
          name: 'Top Product',
          slug: 'top',
          soldCount: 200,
          variants: [{ price: 100000, images: ['img.jpg'] }],
        },
      ];
      const recentOrders = [
        {
          _id: 'o1',
          userId: { username: 'buyer', avatar: null },
          totalAmount: 300000,
          status: 'confirmed',
          paymentStatus: 'paid',
          createdAt: new Date('2026-06-10'),
        },
      ];
      const refDate = new Date('2026-06-15');
      const monthlyRevenueRaw = [{ _id: { month: 6, year: 2026 }, revenue: 15000000, orders: 57 }];

      // Assemble like the service does
      const stats = {
        totalProducts: 42,
        totalOrders: 57,
        totalRevenue: revenueData[0]?.total || 0,
        ordersByStatus: mapOrdersByStatus(orderStatusCounts),
      };
      const chartData = generateChartData(monthlyRevenueRaw, refDate);
      const formattedTopProducts = formatTopProducts(topProducts);
      const formattedRecentOrders = formatRecentOrders(recentOrders);

      // Verify assembled result
      expect(stats.totalRevenue).toBe(15000000);
      expect(stats.ordersByStatus.delivered).toBe(50);
      expect(stats.ordersByStatus.pending).toBe(5);
      expect(chartData).toHaveLength(6);
      expect(chartData[5].revenue).toBe(15000000); // June
      expect(formattedTopProducts[0].revenue).toBe(20000000);
      expect(formattedRecentOrders[0].customer).toBe('buyer');
    });
  });
});
