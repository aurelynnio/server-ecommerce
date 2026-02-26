const Shop = require("../models/shop.model");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const Review = require("../models/review.model");
const ShopFollower = require("../models/shop-follower.model");
const {
  getPaginationParams,
  buildPaginationResponse,
} = require("../utils/pagination");

const slugify = require("slugify");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

class ShopService {
  /**
   * Create shop
   * @param {string} userId
   * @param {any} shopData
   * @returns {Promise<any>}
   */
  async createShop(userId, shopData) {
    const { name, ...otherDetails } = shopData;

    // Check if user already has a shop
    const existingShop = await Shop.findOne({ owner: userId });
    if (existingShop) {
      throw new ApiError(StatusCodes.CONFLICT, "User already owns a shop");
    }

    // Check duplicate name
    const existingName = await Shop.findOne({ name });
    if (existingName) {
      throw new ApiError(StatusCodes.CONFLICT, "Shop name already taken");
    }

    const slug = slugify(name, { lower: true });

    const newShop = await Shop.create({
      owner: userId,
      name,
      slug,
      ...otherDetails,
    });

    // Update User Role to Seller and link shop
    await User.findByIdAndUpdate(userId, {
      roles: "seller",
      shop: newShop._id,
    });

    return newShop;
  }

  /**
   * Get shop info
   * @param {string} shopId
   * @returns {Promise<any>}
   */
  async getShopInfo(shopId) {
    const findShop = await Shop.findById(shopId).lean();
    if (!findShop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }
    return findShop;
  }

  /**
   * Get my shop
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getMyShop(userId) {
    const findShop = await Shop.findOne({ owner: userId }).lean();
    if (!findShop) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "You usually do not have a shop",
      );
    }
    return findShop;
  }

  /**
   * Update shop
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<any>}
   */
  async updateShop(userId, updates) {
    // Remove sensitive fields
    delete updates.owner;
    delete updates.status;
    delete updates.rating;
    delete updates.metrics;

    const updatedShop = await Shop.findOneAndUpdate(
      { owner: userId },
      updates,
      { new: true },
    );

    if (!updatedShop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }
    return updatedShop;
  }

  /**
   * Get all shops with pagination (Admin/Public)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Shops with pagination
   */
  async getAllShops(filters = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sort = "-createdAt",
    } = filters;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Shop.countDocuments(query);
    const paginationParams = getPaginationParams(page, limit, total);

    const shops = await Shop.find(query)
      .populate("owner", "username email")
      .sort(sort)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return buildPaginationResponse(shops, paginationParams);
  }

  /**
   * Get shop by slug (Public)
   * @param {string} slug - Shop slug
   * @returns {Promise<Object>} Shop details with products count
   */
  async getShopBySlug(slug) {
    const shop = await Shop.findOne({ slug, status: "active" })
      .populate("owner", "username avatar")
      .lean();

    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }

    // Get product count
    const productCount = await Product.countDocuments({
      shop: shop._id,
      status: "published",
    });

    // Get follower count from ShopFollower collection
    const followerCount = await ShopFollower.countDocuments({
      shopId: shop._id,
    });

    return {
      ...shop,
      productCount,
      followerCount,
    };
  }

  /**
   * Get shop products (Public)
   * @param {string} shopId - Shop ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products with pagination
   */
  async getShopProducts(shopId, options = {}) {
    const { page = 1, limit = 20, sort = "-createdAt", category } = options;

    const query = { shop: shopId, status: "published" };
    if (category) query.category = category;

    const total = await Product.countDocuments(query);
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort(sort)
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return buildPaginationResponse(products, paginationParams);
  }

  /**
   * Get shop statistics (Seller Dashboard)
   * @param {string} userId - Shop owner ID
   * @returns {Promise<Object>} Shop statistics
   */
  async getShopStatistics(userId) {
    const shop = await Shop.findOne({ owner: userId });
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }

    const shopId = shop._id;
    const [
      totalProducts,
      totalOrders,
      orderStatusCounts,
      revenueData,
      topProducts,
      recentOrders,
    ] = await Promise.all([
      Product.countDocuments({ shop: shopId, status: "published" }),
      Order.countDocuments({ shopId }),

      Order.aggregate([
        { $match: { shopId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { shopId, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Product.find({ shop: shopId, soldCount: { $gt: 0 } })
        .sort({ soldCount: -1 })
        .limit(5)
        .select("name soldCount price variants slug")
        .lean(),

      Order.find({ shopId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("userId", "username avatar")
        .select("_id status totalAmount createdAt paymentStatus")
        .lean(),
    ]);
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
      if (Object.prototype.hasOwnProperty.call(ordersByStatus, item._id)) {
        ordersByStatus[item._id] = item.count;
      }
    });
    const today = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        key: `${d.getMonth() + 1}/${d.getFullYear()}`,
      });
    }

    const monthlyRevenueRaw = await Order.aggregate([
      {
        $match: {
          shopId,
          status: { $ne: "cancelled" },
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
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0],
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Map raw data to lookup object
    const revenueMap = {};
    monthlyRevenueRaw.forEach((item) => {
      const key = `${item._id.month}/${item._id.year}`;
      revenueMap[key] = { revenue: item.revenue, orders: item.orders };
    });

    // Merge with last6Months
    const chartData = last6Months.map((time) => {
      const data = revenueMap[time.key] || { revenue: 0, orders: 0 };
      return {
        month: `T${time.month}`,
        revenue: data.revenue,
        orders: data.orders,
      };
    });

    // Transform top products
    const formattedTopProducts = topProducts.map((product) => {
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

    // Transform recent orders
    const formattedRecentOrders = recentOrders.map((order) => ({
      _id: order._id,
      customer: order.userId?.username || "Guest",
      avatar: order.userId?.avatar || null,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    }));

    return {
      shop: {
        _id: shop._id,
        name: shop.name,
        slug: shop.slug,
        logo: shop.logo,
        banner: shop.banner,
        rating: shop.rating || 0,
        status: shop.status,
        followers: shop.followerCount || 0,
        responseRate: shop.metrics?.responseRate || 0,
      },
      stats: {
        totalProducts,
        totalOrders,
        totalRevenue: revenueData[0]?.total || 0,
        ordersByStatus,
      },
      topProducts: formattedTopProducts,
      recentOrders: formattedRecentOrders,
      chartData,
    };
  }

  /**
   * Follow a shop
   * @param {string} userId - User ID
   * @param {string} shopId - Shop ID
   * @returns {Promise<Object>} Follow result
   */
  async followShop(userId, shopId) {
    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }

    // Check if already following
    const existing = await ShopFollower.findOne({ shopId, userId });
    if (existing) {
      throw new ApiError(StatusCodes.CONFLICT, "Already following this shop");
    }

    await ShopFollower.create({ shopId, userId });

    // Increment cached follower count
    await Shop.findByIdAndUpdate(shopId, { $inc: { followerCount: 1 } });

    const followerCount = await ShopFollower.countDocuments({ shopId });

    return {
      message: "Shop followed successfully",
      followerCount,
    };
  }

  /**
   * Unfollow a shop
   * @param {string} userId - User ID
   * @param {string} shopId - Shop ID
   * @returns {Promise<Object>} Unfollow result
   */
  async unfollowShop(userId, shopId) {
    const result = await ShopFollower.deleteOne({ shopId, userId });

    if (result.deletedCount > 0) {
      await Shop.findByIdAndUpdate(shopId, { $inc: { followerCount: -1 } });
    }

    return { message: "Shop unfollowed successfully" };
  }

  /**
   * Get shops followed by user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Followed shops
   */
  async getFollowedShops(userId) {
    const followedEntries = await ShopFollower.find({ userId })
      .select("shopId")
      .lean();

    const shopIds = followedEntries.map((entry) => entry.shopId);

    const shops = await Shop.find({
      _id: { $in: shopIds },
      status: "active",
    })
      .select("name slug logo rating")
      .lean();

    return shops;
  }

  /**
   * Update shop status (Admin)
   * @param {string} shopId - Shop ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated shop
   */
  async updateShopStatus(shopId, status) {
    const validStatuses = ["pending", "active", "suspended", "closed"];
    if (!validStatuses.includes(status)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid status");
    }

    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { status },
      { new: true },
    );

    if (!shop) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Shop not found");
    }

    return shop;
  }

  /**
   * Get shop reviews/ratings
   * @param {string} shopId - Shop ID
   * @returns {Promise<Object>} Shop rating statistics
   */
  async getShopRatings(shopId) {
    const products = await Product.find({ shop: shopId }).select("_id");
    const productIds = products.map((p) => p._id);

    const stats = await Review.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        },
      },
    ]);

    return (
      stats[0] || {
        averageRating: 0,
        totalReviews: 0,
        rating5: 0,
        rating4: 0,
        rating3: 0,
        rating2: 0,
        rating1: 0,
      }
    );
  }

  /**
   * Get shop categories (categories of products in shop)
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>} Categories with product count
   */
  async getShopCategories(shopId) {
    const categories = await Product.aggregate([
      { $match: { shop: shopId, status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: "$category._id",
          name: "$category.name",
          slug: "$category.slug",
          productCount: "$count",
        },
      },
      { $sort: { productCount: -1 } },
    ]);

    return categories;
  }
}

module.exports = new ShopService();
