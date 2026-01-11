const Order = require("../models/order.model");
const User = require("../models/user.model");
const Product = require("../models/product.model");

class StatisticsService {
  /**
   * Get overall dashboard statistics
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardStats() {
    // 1. Counts
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({ roles: "user" });
    const totalProducts = await Product.countDocuments({ status: "published" });

    // 2. Recent Orders (5)
    const recentOrdersRaw = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "username email avatar")
      .lean();
    
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

    // 3. Top Products (By Revenue or Sold Count) - Only products with sales
    const topProductsRaw = await Product.find({ soldCount: { $gt: 0 } })
      .sort({ soldCount: -1 })
      .limit(5)
      .select("name price soldCount variants slug")
      .lean();
    
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

    const monthlyStatsRaw = await Order.aggregate([
      {
        $match: {
          status: { $ne: "cancelled" }, // Exclude cancelled, include pending/unpaid
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 5)), 
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0]
            }
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

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
      totalRevenue: totalRevenue[0]?.total || 0,
      totalOrders: totalOrders,
      totalUsers: totalUsers,
      totalProducts: totalProducts,
      // Also include counts object for backward compatibility
      counts: {
        revenue: totalRevenue[0]?.total || 0,
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
