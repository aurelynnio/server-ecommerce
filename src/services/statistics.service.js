const Order = require('../repositories/order.repository');
const User = require('../repositories/user.repository');
const Product = require('../repositories/product.repository');
const { buildMonthlyChartData } = require('../utils/query.utils');

class StatisticsService {
  _getPeriodBounds() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    return {
      startOfToday,
      startOfTomorrow,
      startOfCurrentMonth,
      startOfNextMonth,
      startOfPreviousMonth,
    };
  }

  _calculateGrowth(currentValue, previousValue) {
    if (!previousValue) {
      return currentValue > 0 ? 100 : 0;
    }

    return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
  }

  /**
   * Get overall dashboard statistics
   * PERFORMANCE FIX: Use $facet to combine multiple counts into single query
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardStats() {
    const bounds = this._getPeriodBounds();

    const [
      orderAggResultRaw,
      totalUsers,
      totalProducts,
      recentOrdersRaw,
      topProductsRaw,
      monthlyStatsRaw,
      orderPeriodStatsRaw,
      userPeriodStatsRaw,
      pendingOrders,
      lowStockProducts,
    ] = await Promise.all([
      Order.aggregateRevenueAndOrderCount(),
      User.countUsersByRole(),
      Product.countPublishedProducts(),
      Order.findRecentWithUser(5),
      Product.findTopSellingProducts(5),
      Order.aggregateMonthlyStatsLastMonths(6),
      Order.aggregateDashboardPeriodStats(bounds),
      User.aggregateDashboardPeriodCounts(bounds),
      Order.countByStatus('pending'),
      Product.countLowStockPublished(),
    ]);

    const orderAggResult = orderAggResultRaw?.[0] || {};
    const totalRevenue = orderAggResult.totalRevenue?.[0]?.total || 0;
    const totalOrders = orderAggResult.totalOrders?.[0]?.count || 0;
    const orderPeriodStats = orderPeriodStatsRaw?.[0] || {};
    const userPeriodStats = userPeriodStatsRaw?.[0] || {};
    const newOrdersToday = orderPeriodStats.newOrdersToday || 0;
    const revenueToday = orderPeriodStats.revenueToday || 0;
    const currentMonthOrders = orderPeriodStats.currentMonthOrders || 0;
    const previousMonthOrders = orderPeriodStats.previousMonthOrders || 0;
    const currentMonthRevenue = orderPeriodStats.currentMonthRevenue || 0;
    const previousMonthRevenue = orderPeriodStats.previousMonthRevenue || 0;
    const newUsersToday = userPeriodStats.newUsersToday || 0;
    const currentMonthUsers = userPeriodStats.currentMonthUsers || 0;
    const previousMonthUsers = userPeriodStats.previousMonthUsers || 0;

    // Transform recentOrders to match client expected format
    const recentOrders = recentOrdersRaw.map((order) => ({
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

    // Transform topProducts to match client expected format
    const topProducts = topProductsRaw.map((product) => {
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
        price, // Also include price for display purposes
      };
    });

    // 4. Monthly Revenue & Orders (Last 6 months) for Chart
    const chartData = buildMonthlyChartData(monthlyStatsRaw, 6);

    const revenueGrowth = this._calculateGrowth(currentMonthRevenue, previousMonthRevenue);
    const orderGrowth = this._calculateGrowth(currentMonthOrders, previousMonthOrders);
    const userGrowth = this._calculateGrowth(currentMonthUsers, previousMonthUsers);

    return {
      // Flat structure for stats cards
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      // Also include counts object for backward compatibility
      counts: {
        revenue: totalRevenue,
        orders: totalOrders,
        users: totalUsers,
        products: totalProducts,
      },
      newUsersToday,
      newOrdersToday,
      revenueToday,
      pendingOrders,
      lowStockProducts,
      userGrowth,
      orderGrowth,
      revenueGrowth,
      recentOrders,
      topProducts,
      chartData,
    };
  }
}

module.exports = new StatisticsService();
