const Order = require("../models/order.model");
const BaseRepository = require("./base.repository");

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  _buildDateFilter(startDate, endDate) {
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.createdAt.$lte = new Date(endDate);
      }
    }
    return dateFilter;
  }

  aggregateRevenueAndOrderCount() {
    return this.aggregateByPipeline([
      {
        $facet: {
          totalRevenue: [
            { $match: { paymentStatus: "paid" } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
          ],
          totalOrders: [{ $count: "count" }],
        },
      },
    ]);
  }

  findRecentWithUser(limit = 5) {
    return this.findManyByFilter()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "username email avatar")
      .lean();
  }

  aggregateMonthlyStatsLastMonths(monthCount = 6, extraMatch = {}) {
    const fromDate = new Date(new Date().setMonth(new Date().getMonth() - (monthCount - 1)));

    return this.aggregateByPipeline([
      {
        $match: {
          ...extraMatch,
          status: { $ne: "cancelled" },
          createdAt: { $gte: fromDate },
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
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  }

  countByShopId(shopId) {
    return this.countByFilter({ shopId });
  }

  aggregateStatusCountsByShopId(shopId) {
    return this.aggregateByPipeline([
      { $match: { shopId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
  }

  aggregatePaidRevenueByShopId(shopId) {
    return this.aggregateByPipeline([
      { $match: { shopId, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
  }

  findRecentByShopIdWithUser(shopId, limit = 5) {
    return this.findManyByFilter({ shopId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "username avatar")
      .select("_id status totalAmount createdAt paymentStatus")
      .lean();
  }

  findByOrderGroupIdLean(orderGroupId) {
    return this.findManyByFilter({ orderGroupId }).lean();
  }

  findByUserIdWithShopAndProducts(userId) {
    return this.findManyByFilter({ userId })
      .populate("shopId", "name logo")
      .populate("products.productId", "name slug")
      .sort({ createdAt: -1 })
      .lean();
  }

  findByShopIdWithUser(shopId) {
    return this.findManyByFilter({ shopId })
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();
  }

  countByShopWithFilters(shopId, { status, paymentStatus } = {}) {
    const query = { shopId };
    if (status && status !== "all") {
      query.status = status;
    }
    if (paymentStatus && paymentStatus !== "all") {
      query.paymentStatus = paymentStatus;
    }

    return this.countByFilter(query);
  }

  findByShopWithFilters(
    shopId,
    { status, paymentStatus } = {},
    { skip = 0, limit = 10 } = {},
  ) {
    const query = { shopId };
    if (status && status !== "all") {
      query.status = status;
    }
    if (paymentStatus && paymentStatus !== "all") {
      query.paymentStatus = paymentStatus;
    }

    return this.findManyByFilter(query)
      .populate("userId", "username email avatar")
      .populate("products.productId", "name slug images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  findByIdAndShop(orderId, shopId) {
    return this.findOneByFilter({ _id: orderId, shopId });
  }

  findByIdAndUser(orderId, userId) {
    return this.findOneByFilter({ _id: orderId, userId });
  }

  findByIdWithShopAndProducts(orderId) {
    return this.findById(orderId)
      .populate("shopId", "name logo slug")
      .populate("products.productId", "name slug images")
      .lean();
  }

  existsDeliveredOrderForProductByUser(userId, productId) {
    return this.existsByFilter({
      userId,
      "products.productId": productId,
      status: "delivered",
    });
  }

  findRecentNonCancelledOrdersByUser(userId, limit = 10) {
    return this.findManyByFilter({
      userId,
      status: { $ne: "cancelled" },
    })
      .select("products.productId")
      .limit(limit)
      .lean();
  }

  findOrdersContainingProduct(productId, limit = 100) {
    return this.findManyByFilter({
      "products.productId": productId,
      status: { $ne: "cancelled" },
    })
      .select("products.productId")
      .limit(limit)
      .lean();
  }

  aggregateSellerOrdersByStatus(shopId) {
    return this.aggregateByPipeline([
      { $match: { shopId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);
  }

  aggregateSellerRevenueStats(shopId) {
    return this.aggregateByPipeline([
      {
        $match: {
          shopId,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);
  }

  aggregateSellerDailyOrders(shopId, sinceDate) {
    return this.aggregateByPipeline([
      {
        $match: {
          shopId,
          createdAt: { $gte: sinceDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);
  }

  aggregateSellerTopProducts(shopId, limit = 10) {
    return this.aggregateByPipeline([
      {
        $match: {
          shopId,
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          productName: { $first: "$products.name" },
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: { $sum: "$products.totalPrice" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
    ]);
  }

  aggregateSellerSummaryCounts(shopId) {
    return this.aggregateByPipeline([
      { $match: { shopId } },
      {
        $facet: {
          total: [{ $count: "count" }],
          pending: [{ $match: { status: "pending" } }, { $count: "count" }],
          completed: [{ $match: { status: "delivered" } }, { $count: "count" }],
          cancelled: [{ $match: { status: "cancelled" } }, { $count: "count" }],
        },
      },
    ]);
  }

  countAllWithFilters({ shop, status } = {}) {
    const query = {};
    if (shop) {
      query.shopId = shop;
    }
    if (status && status !== "all") {
      query.status = status;
    }

    return this.countByFilter(query);
  }

  findAllWithFilters(
    { shop, status } = {},
    { skip = 0, limit = 20 } = {},
  ) {
    const query = {};
    if (shop) {
      query.shopId = shop;
    }
    if (status && status !== "all") {
      query.status = status;
    }

    return this.findManyByFilter(query)
      .populate("userId", "username email")
      .populate("shopId", "name logo slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  aggregateAdminOrdersByStatus(dateFilter = {}) {
    return this.aggregateByPipeline([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);
  }

  aggregateAdminRevenueStats(dateFilter = {}) {
    return this.aggregateByPipeline([
      {
        $match: {
          ...dateFilter,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);
  }

  aggregateAdminOrdersByPaymentMethod(dateFilter = {}) {
    return this.aggregateByPipeline([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);
  }

  aggregateAdminDailyOrders(sinceDate) {
    return this.aggregateByPipeline([
      {
        $match: {
          createdAt: { $gte: sinceDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);
  }

  aggregateAdminTopProducts(dateFilter = {}, limit = 10) {
    return this.aggregateByPipeline([
      { $match: { ...dateFilter, status: { $ne: "cancelled" } } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          productName: { $first: "$products.name" },
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: { $sum: "$products.totalPrice" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
    ]);
  }

  aggregateAdminOrdersByShop(dateFilter = {}, limit = 10) {
    return this.aggregateByPipeline([
      { $match: dateFilter },
      {
        $group: {
          _id: "$shopId",
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "shops",
          localField: "_id",
          foreignField: "_id",
          as: "shop",
        },
      },
      { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          shopId: "$_id",
          shopName: "$shop.name",
          orderCount: 1,
          totalRevenue: 1,
        },
      },
    ]);
  }

  aggregateAdminSummaryCounts(dateFilter = {}) {
    return this.aggregateByPipeline([
      { $match: dateFilter },
      {
        $facet: {
          total: [{ $count: "count" }],
          pending: [{ $match: { status: "pending" } }, { $count: "count" }],
          completed: [{ $match: { status: "delivered" } }, { $count: "count" }],
          cancelled: [{ $match: { status: "cancelled" } }, { $count: "count" }],
        },
      },
    ]);
  }

  aggregateAdminOrdersByStatusInRange(startDate, endDate) {
    return this.aggregateAdminOrdersByStatus(this._buildDateFilter(startDate, endDate));
  }

  aggregateAdminRevenueStatsInRange(startDate, endDate) {
    return this.aggregateAdminRevenueStats(this._buildDateFilter(startDate, endDate));
  }

  aggregateAdminOrdersByPaymentMethodInRange(startDate, endDate) {
    return this.aggregateAdminOrdersByPaymentMethod(
      this._buildDateFilter(startDate, endDate),
    );
  }

  aggregateAdminTopProductsInRange(startDate, endDate, limit = 10) {
    return this.aggregateAdminTopProducts(
      this._buildDateFilter(startDate, endDate),
      limit,
    );
  }

  aggregateAdminOrdersByShopInRange(startDate, endDate, limit = 10) {
    return this.aggregateAdminOrdersByShop(this._buildDateFilter(startDate, endDate), limit);
  }

  aggregateAdminSummaryCountsInRange(startDate, endDate) {
    return this.aggregateAdminSummaryCounts(this._buildDateFilter(startDate, endDate));
  }
}

module.exports = new OrderRepository();
