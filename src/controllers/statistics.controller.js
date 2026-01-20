const statisticsService = require("../services/statistics.service");
const catchAsync = require("../configs/catchAsync");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess } = require("../shared/res/formatResponse");

/**
 * Statistics Controller
 * Handles dashboard and analytics statistics for admin
 */
const statisticsController = {
  /**
   * Get dashboard statistics overview

* @access  Private (Admin only)

   *   - totalUsers: Total registered users
   *   - totalOrders: Total orders count
   *   - totalRevenue: Total revenue
   *   - totalProducts: Total products count
   *   - recentOrders: Recent orders list
   *   - ordersByStatus: Orders grouped by status
   *   - revenueByMonth: Monthly revenue data
   */
  getDashboardStats: catchAsync(async (req, res) => {
    const stats = await statisticsService.getDashboardStats();
    
    return sendSuccess(
      res,
      stats,
      "Get dashboard statistics successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = statisticsController;
