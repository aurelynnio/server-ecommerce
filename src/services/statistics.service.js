const Order = require("../repositories/order.repository");
const User = require("../repositories/user.repository");
const Product = require("../repositories/product.repository");

class StatisticsService {
  /**
   * Get overall dashboard statistics
   * PERFORMANCE FIX: Use $facet to combine multiple counts into single query
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardStats() {
    // PERFORMANCE FIX: Combine all counts into single aggregation with $facet
    const [countsResult, recentOrdersRaw, topProductsRaw, monthlyStatsRaw] = await Promise.all([
      // Single aggregation for all counts
      Promise.all([
        Order.aggregateRevenueAndOrderCount(),
        User.countUsersByRole(),
        Product.countPublishedProducts()
      ]),

      // Recent Orders (5)
      Order.findRecentWithUser(5),

      // Top Products (By Revenue or Sold Count) - Only products with sales
      Product.findTopSellingProducts(5),

      // Monthly Stats
      Order.aggregateMonthlyStatsLastMonths(6)
    ]);

    // Extract counts from aggregation result
    const orderAggResult = countsResult[0][0]?.[0] || {};
    const totalRevenue = orderAggResult.totalRevenue?.[0]?.total || 0;
    const totalOrders = orderAggResult.totalOrders?.[0]?.count || 0;
    const totalUsers = countsResult[1];
    const totalProducts = countsResult[2];
    
    // Transform recentOrders to match client expected format
    const recentOrders = recentOrdersRaw.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber || order._id.toString().slice(-6).toUpperCase(),
      user: order.userId ? {
        name: order.userId.username || order.userId.email || 'Guest',
        avatar: order.userId.avatar || null
      } : { name: 'Guest', avatar: null },
      totalAmount: order.totalAmount || 0,
      status: order.status,
      createdAt: order.createdAt
    }));

    // Transform topProducts to match client expected format
    const topProducts = topProductsRaw.map(product => {
      // Get first variant image if available
      const image = product.variants?.[0]?.images?.[0] || null;
      // Calculate revenue: price * soldCount
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
        price // Also include price for display purposes
      };
    });
    
    // 4. Monthly Revenue & Orders (Last 6 months) for Chart
    const today = new Date();
    
    // Create an array of the last 6 months (keys: "M/Y")
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last6Months.push({
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            key: `${d.getMonth() + 1}/${d.getFullYear()}`
        });
    }

    // Map raw data to a lookup object
    const statsMap = {};
    monthlyStatsRaw.forEach(item => {
        const key = `${item._id.month}/${item._id.year}`;
        statsMap[key] = { revenue: item.revenue, orders: item.orders };
    });

    // Merge with last6Months to ensure full data
    const chartData = last6Months.map(time => {
        const data = statsMap[time.key] || { revenue: 0, orders: 0 };
        return {
            month: `T${time.month}`,
            revenue: data.revenue,
            orders: data.orders
        };
    });

    return {
      // Flat structure for stats cards
      totalRevenue: totalRevenue,
      totalOrders: totalOrders,
      totalUsers: totalUsers,
      totalProducts: totalProducts,
      // Also include counts object for backward compatibility
      counts: {
        revenue: totalRevenue,
        orders: totalOrders,
        users: totalUsers,
        products: totalProducts,
      },
      recentOrders,
      topProducts,
      chartData,
    };
  }
}

module.exports = new StatisticsService();


