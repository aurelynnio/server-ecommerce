const Order = require("../models/order.model");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const Review = require("../models/review.model");

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
    const totalProducts = await Product.countDocuments({ isActive: true });

    // 2. Recent Orders (5)
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "username email avatar")
      .lean();

    // 3. Top Products (By Revenue or Sold Count)
    const topProducts = await Product.find()
      .sort({ soldCount: -1 })
      .limit(5)
      .select("name price soldCount variants slug")
      .lean();
    
    // 4. Monthly Revenue & Orders (Last 6 months) for Chart
    const currentYear = new Date().getFullYear();
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
