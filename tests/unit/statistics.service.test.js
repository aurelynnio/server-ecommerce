/**
 * Unit Tests: Statistics Service Logic
 * Tests dashboard transforms: recentOrders, topProducts, chartData, counts extraction
 */
import { describe, it, expect } from 'vitest';

describe('StatisticsService Logic', () => {
  // --- Extract counts from facet aggregation ---
  describe('extractCounts', () => {
    const extractCounts = (aggResult) => {
      const result = aggResult?.[0] || {};
      return {
        totalRevenue: result.totalRevenue?.[0]?.total || 0,
        totalOrders: result.totalOrders?.[0]?.count || 0,
      };
    };

    it('should extract revenue and orders from valid result', () => {
      const agg = [
        {
          totalRevenue: [{ total: 50000000 }],
          totalOrders: [{ count: 150 }],
        },
      ];
      const result = extractCounts(agg);
      expect(result.totalRevenue).toBe(50000000);
      expect(result.totalOrders).toBe(150);
    });

    it('should default to 0 when empty result', () => {
      const result = extractCounts([]);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
    });

    it('should default to 0 when null', () => {
      const result = extractCounts(null);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
    });

    it('should default revenue to 0 when no paid orders', () => {
      const agg = [
        {
          totalRevenue: [],
          totalOrders: [{ count: 10 }],
        },
      ];
      const result = extractCounts(agg);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(10);
    });
  });

  // --- recentOrders transform ---
  describe('transformRecentOrders', () => {
    const transformRecentOrders = (orders) => {
      return orders.map((order) => ({
        _id: order._id,
        orderNumber: order.orderNumber || order._id.toString().slice(-6).toUpperCase(),
        user: order.userId
          ? {
              name: order.userId.username || order.userId.email || 'Guest',
              avatar: order.userId.avatar || null,
            }
          : { name: 'Guest', avatar: null },
        totalAmount: order.totalAmount || 0,
        status: order.status,
        createdAt: order.createdAt,
      }));
    };

    it('should transform order with full user info', () => {
      const orders = [
        {
          _id: 'order1',
          orderNumber: 'ORD-100',
          userId: { username: 'john', avatar: 'av.jpg' },
          totalAmount: 200000,
          status: 'delivered',
          createdAt: '2024-01-01',
        },
      ];
      const result = transformRecentOrders(orders);
      expect(result[0].orderNumber).toBe('ORD-100');
      expect(result[0].user).toEqual({ name: 'john', avatar: 'av.jpg' });
      expect(result[0].totalAmount).toBe(200000);
    });

    it('should generate orderNumber from _id', () => {
      const result = transformRecentOrders([
        { _id: 'abcdef123456', userId: null, status: 'pending' },
      ]);
      expect(result[0].orderNumber).toBe('123456');
    });

    it('should fallback user.name to email', () => {
      const result = transformRecentOrders([
        { _id: '1', userId: { email: 'a@b.com' }, status: 'pending' },
      ]);
      expect(result[0].user.name).toBe('a@b.com');
    });

    it('should show Guest when no userId', () => {
      const result = transformRecentOrders([{ _id: '1', userId: null, status: 'pending' }]);
      expect(result[0].user).toEqual({ name: 'Guest', avatar: null });
    });

    it('should default totalAmount to 0', () => {
      const result = transformRecentOrders([{ _id: '1', userId: null, status: 'pending' }]);
      expect(result[0].totalAmount).toBe(0);
    });
  });

  // --- topProducts transform ---
  describe('transformTopProducts', () => {
    const transformTopProducts = (products) => {
      return products.map((product) => {
        const image = product.variants?.[0]?.images?.[0] || null;
        const price = product.variants?.[0]?.price || product.price?.currentPrice || 0;
        const sold = product.soldCount || 0;
        const revenue = price * sold;

        return {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          image,
          sold,
          revenue,
          price,
        };
      });
    };

    it('should extract variant image and calculate revenue', () => {
      const products = [
        {
          _id: 'p1',
          name: 'Shirt',
          slug: 'shirt',
          variants: [{ images: ['shirt.jpg'], price: 150000 }],
          soldCount: 100,
        },
      ];
      const result = transformTopProducts(products);
      expect(result[0].image).toBe('shirt.jpg');
      expect(result[0].price).toBe(150000);
      expect(result[0].sold).toBe(100);
      expect(result[0].revenue).toBe(15000000);
    });

    it('should fallback to currentPrice when no variant price', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          variants: [{ images: [] }],
          price: { currentPrice: 200000 },
          soldCount: 50,
        },
      ];
      const result = transformTopProducts(products);
      expect(result[0].price).toBe(200000);
      expect(result[0].revenue).toBe(10000000);
    });

    it('should handle no variants at all', () => {
      const products = [{ _id: 'p1', name: 'A', slug: 'a', soldCount: 0 }];
      const result = transformTopProducts(products);
      expect(result[0].image).toBeNull();
      expect(result[0].price).toBe(0);
      expect(result[0].revenue).toBe(0);
    });
  });

  // --- last6Months + chartData ---
  describe('chartData', () => {
    const buildChartData = (today, monthlyStatsRaw) => {
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last6Months.push({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          key: `${d.getMonth() + 1}/${d.getFullYear()}`,
        });
      }

      const statsMap = {};
      monthlyStatsRaw.forEach((item) => {
        const key = `${item._id.month}/${item._id.year}`;
        statsMap[key] = { revenue: item.revenue, orders: item.orders };
      });

      return last6Months.map((time) => {
        const data = statsMap[time.key] || { revenue: 0, orders: 0 };
        return {
          month: `T${time.month}`,
          revenue: data.revenue,
          orders: data.orders,
        };
      });
    };

    it('should generate 6 months of chart data', () => {
      const result = buildChartData(new Date(2024, 5, 1), []);
      expect(result).toHaveLength(6);
    });

    it('should fill missing months with zeros', () => {
      const result = buildChartData(new Date(2024, 5, 1), []);
      result.forEach((d) => {
        expect(d.revenue).toBe(0);
        expect(d.orders).toBe(0);
      });
    });

    it('should merge stats into correct months', () => {
      const stats = [{ _id: { month: 3, year: 2024 }, revenue: 5000000, orders: 20 }];
      const result = buildChartData(new Date(2024, 5, 1), stats);
      const march = result.find((d) => d.month === 'T3');
      expect(march.revenue).toBe(5000000);
      expect(march.orders).toBe(20);
    });

    it('should format months as T{n}', () => {
      const result = buildChartData(new Date(2024, 5, 1), []);
      expect(result[5].month).toBe('T6');
      expect(result[0].month).toBe('T1');
    });

    it('should handle year boundary', () => {
      const result = buildChartData(new Date(2024, 1, 1), []);
      expect(result[0].month).toBe('T9');
      expect(result[5].month).toBe('T2');
    });
  });

  // --- Dashboard response structure ---
  describe('dashboardResponseStructure', () => {
    const buildResponse = ({
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      recentOrders,
      topProducts,
      chartData,
    }) => ({
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      counts: {
        revenue: totalRevenue,
        orders: totalOrders,
        users: totalUsers,
        products: totalProducts,
      },
      recentOrders,
      topProducts,
      chartData,
    });

    it('should include flat stats and counts object', () => {
      const result = buildResponse({
        totalRevenue: 100000,
        totalOrders: 50,
        totalUsers: 200,
        totalProducts: 80,
        recentOrders: [],
        topProducts: [],
        chartData: [],
      });
      expect(result.totalRevenue).toBe(100000);
      expect(result.counts.revenue).toBe(100000);
      expect(result.counts.orders).toBe(50);
      expect(result.counts.users).toBe(200);
      expect(result.counts.products).toBe(80);
    });

    it('should include all required fields', () => {
      const result = buildResponse({
        totalRevenue: 0,
        totalOrders: 0,
        totalUsers: 0,
        totalProducts: 0,
        recentOrders: [],
        topProducts: [],
        chartData: [],
      });
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalOrders');
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalProducts');
      expect(result).toHaveProperty('counts');
      expect(result).toHaveProperty('recentOrders');
      expect(result).toHaveProperty('topProducts');
      expect(result).toHaveProperty('chartData');
    });
  });
});
