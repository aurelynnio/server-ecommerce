const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const { Types } = require("mongoose");
const mongoose = require("mongoose");

const voucherService = require("./voucher.service");
const Voucher = require("../models/voucher.model");
const inventoryService = require("./inventory.service");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");
const { getPaginationParams, buildPaginationResponse } = require("../utils/pagination");

/**
 * Service handling order operations
 * Manages order creation, retrieval, status updates, and statistics
 */
class OrderService {
  /**
   * Create orders from cart items with transaction support
   * Splits items by shop and creates separate orders per shop
   * @param {string} userId - User ID placing the order
   * @param {Object} orderData - Order details
   * @param {string[]} orderData.cartItemIds - Cart item IDs to checkout
   * @param {Object} orderData.shippingAddress - Shipping address details
   * @param {string} [orderData.paymentMethod="cod"] - Payment method
   * @param {Array} [orderData.shopVouchers] - Shop-specific vouchers [{shopId, code}]
   * @param {string} [orderData.platformVoucher] - Platform voucher code
   * @param {string} [orderData.note] - Order note
   * @returns {Promise<Object>} Created orders with group ID
   * @throws {Error} If cart is empty, items unavailable, or out of stock
   */
  async createOrder(userId, orderData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const {
        cartItemIds,
        shippingAddress,
        paymentMethod = "cod",
        shopVouchers = [], // Array of { shopId, code }
        platformVoucher, // String (code)
        note,
      } = orderData;

      // 1. Get Selected Items from Cart
      const cart = await Cart.findOne({ userId }).populate("items.productId").session(session);
      if (!cart) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Cart is empty");
      }

      const itemsToCheckout = cart.items.filter((item) =>
        cartItemIds.includes(item._id.toString())
      );

      if (itemsToCheckout.length === 0) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "No items selected");
      }

      // 2. Group items by Shop
      const shopItemsMap = new Map(); // shopId -> [items]

      for (const item of itemsToCheckout) {
        const product = item.productId;
        if (!product) {
          throw new ApiError(StatusCodes.NOT_FOUND, "Product info missing");
        }

        // Ensure shopId is available
        let shopId = item.shopId;
        if (!shopId && product.shop) shopId = product.shop;

        if (!shopId) {
          throw new ApiError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            `Product ${product.name} has no shop`
          );
        }

        const shopIdStr = shopId.toString();
        if (!shopItemsMap.has(shopIdStr)) {
          shopItemsMap.set(shopIdStr, []);
        }
        shopItemsMap.get(shopIdStr).push(item);
      }

      // 3. Create Orders per Shop
      const orderGroupId = new Types.ObjectId();
      const createdOrders = [];
      let totalPlatformOrderValue = 0; // To check platform voucher condition

      // Temporary storage for created orders to update them later with Platform Discount
      const tempOrders = [];

      // Loop through confirmed shop groups
      for (const [shopId, items] of shopItemsMap.entries()) {
        const orderProducts = [];
        let subtotal = 0;
        const inventoryItems = [];

        // Batch fetch products to optimize performance
        const productIds = items.map(item => item.productId._id);
        const products = await Product.find({ _id: { $in: productIds } }).session(session);
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        // Verify Price & Build Inventory List
        for (const item of items) {
          const product = productMap.get(item.productId._id.toString());
          if (!product || product.status !== "published") {
            throw new ApiError(
              StatusCodes.CONFLICT,
              `${item.productId.name} unavailable`
            );
          }

          let price = product.price.currentPrice;
          let skuCode = "";
          let tierIndex = [];

          if (item.modelId) {
            const variant = product.variants?.find(
              (v) => v._id.toString() === item.modelId.toString()
            );

            if (!variant) {
              throw new ApiError(
                StatusCodes.NOT_FOUND,
                `Variation for ${product.name} no longer exists`
              );
            }

            // Note: Stock check is now handled by inventoryService.deductStock

            price = variant.price;
            skuCode = variant.sku;
            tierIndex = variant.tierIndex || []; // Handle optional tierIndex

            inventoryItems.push({
                productId: product._id,
                modelId: item.modelId,
                quantity: item.quantity
            });
          } else {
            // Base product
            inventoryItems.push({
                productId: product._id,
                quantity: item.quantity
            });
          }

          subtotal += price * item.quantity;

          orderProducts.push({
            productId: product._id,
            sku: skuCode,
            modelId: item.modelId,
            name: product.name, // Snapshot name
            image: product.images?.[0] || "", // simplified
            tierIndex,
            quantity: item.quantity,
            price,
            totalPrice: price * item.quantity,
          });
        }

        // --- DEDUCT STOCK (via InventoryService) ---
        await inventoryService.deductStock(inventoryItems, session);

        // --- APPLY SHOP VOUCHER ---
        let discountShop = 0;
        const shopVoucherEntry = shopVouchers.find((v) => v.shopId === shopId);
        if (shopVoucherEntry) {
          const voucherResult = await voucherService.applyVoucher(
            shopVoucherEntry.code,
            userId,
            subtotal,
            shopId
          );
          discountShop = voucherResult.discountAmount;

          // Increment usage
          await Voucher.findByIdAndUpdate(
            voucherResult.voucherId,
            {
              $inc: { usageCount: 1 },
              $push: { usedBy: userId },
            },
            { session }
          );
        }

        const totalAmount = Math.max(0, subtotal - discountShop);
        totalPlatformOrderValue += totalAmount; // Platform discount applies on total after shop discount

        // 4. Create Order Object (Not save yet)
        const newOrder = new Order({
          orderGroupId,
          userId,
          shopId,
          products: orderProducts,
          shippingAddress: { ...shippingAddress, note },
          paymentMethod,
          subtotal,
          discountShop, // Saved here
          discountPlatform: 0,
          totalAmount, // Temporary, will subtract platform discount later
          status: "pending",
        });

        tempOrders.push(newOrder);
      }

      // --- APPLY PLATFORM VOUCHER (One for all) ---
      if (platformVoucher) {
        const voucherResult = await voucherService.applyVoucher(
          platformVoucher,
          userId,
          totalPlatformOrderValue
        );

        const totalPlatformDiscount = voucherResult.discountAmount;

        // Distribute platform discount to each order proportionally
        // Weight = Order.totalAmount / totalPlatformOrderValue
        let distributedDiscount = 0;

        tempOrders.forEach((order, index) => {
          if (index === tempOrders.length - 1) {
            // Last order takes the remainder to handle rounding issues
            order.discountPlatform = Math.max(
              0,
              totalPlatformDiscount - distributedDiscount
            );
          } else {
            const ratio = order.totalAmount / totalPlatformOrderValue;
            const portion = Math.floor(totalPlatformDiscount * ratio);
            order.discountPlatform = portion;
            distributedDiscount += portion;
          }

          // Recalculate Final Total per Order
          order.totalAmount = Math.max(
            0,
            order.totalAmount - order.discountPlatform
          );
        });

        // Increment usage
        await Voucher.findByIdAndUpdate(
          voucherResult.voucherId,
          {
            $inc: { usageCount: 1 },
            $push: { usedBy: userId },
          },
          { session }
        );
      }

      // Save All Orders within transaction
      for (const order of tempOrders) {
        await order.save({ session });
        createdOrders.push(order);
      }

      // 5. Cleanup Cart
      // Filter out checked out items
      cart.items = cart.items.filter(
        (item) => !cartItemIds.includes(item._id.toString())
      );
      cart.totalAmount = this.calculateTotal(cart.items);
      await cart.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      // Return group details
      return {
        message: "Orders created successfully",
        orderGroupId,
        orders: createdOrders,
      };
    } catch (error) {
      // Abort transaction on error - all changes will be rolled back
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Calculate total amount from cart items
   * @param {Array} items - Cart items with price and quantity
   * @returns {number} Total amount
   */
  calculateTotal(items) {
    return items.reduce((total, item) => {
      const price = item.price || 0;
      return total + price * item.quantity;
    }, 0);
  }

  /**
   * Get all orders for a user
   * @param {string} userId - User ID
   * @param {Object} [filters] - Optional filters (unused, for future expansion)
   * @returns {Promise<Object>} User's orders
   */
  async getUserOrders(userId, filters = {}) {
    const orders = await Order.find({ userId })
      .populate("shopId", "name logo")
      .populate("products.productId", "name slug")
      .sort({ createdAt: -1 })
      .lean();
    return { data: orders }; // Unified response structure
  }

  /**
   * Get all orders for a shop (Seller dashboard)
   * @param {string} shopId - Shop ID
   * @param {Object} [filters] - Optional filters (unused, for future expansion)
   * @returns {Promise<Object>} Shop's orders
   */
  async getShopOrders(shopId, filters = {}) {
    const orders = await Order.find({ shopId })
      .populate("userId", "username")
      .sort({ createdAt: -1 })
      .lean();
    return { data: orders };
  }

  /**
   * Get orders for a specific shop with pagination and filters
   * @param {string} shopId - Shop ID
   * @param {Object} filters - Query filters
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=10] - Items per page
   * @param {string} [filters.status] - Filter by status
   * @param {string} [filters.paymentStatus] - Filter by payment status
   * @returns {Promise<Object>} Paginated orders
   */
  async getOrdersByShop(shopId, filters = {}) {
    const { page = 1, limit = 10, status, paymentStatus } = filters;

    const query = { shopId };

    if (status && status !== "all") {
      query.status = status;
    }

    if (paymentStatus && paymentStatus !== "all") {
      query.paymentStatus = paymentStatus;
    }

    const total = await Order.countDocuments(query);
    const paginationParams = getPaginationParams(page, limit, total);

    const orders = await Order.find(query)
      .populate("userId", "username email avatar")
      .populate("products.productId", "name slug images")
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return buildPaginationResponse(orders, paginationParams);
  }

  /**
   * Update order status by seller
   * Seller can only update: pending -> confirmed -> processing -> shipped
   * @param {string} orderId - Order ID
   * @param {string} shopId - Seller's shop ID
   * @param {string} newStatus - New status
   * @returns {Promise<Object>} Updated order
   * @throws {Error} If invalid status transition
   */
  async updateOrderStatusBySeller(orderId, shopId, newStatus) {
    const order = await Order.findOne({ _id: orderId, shopId });

    if (!order) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Order not found or doesn't belong to your shop"
      );
    }

    // Seller allowed transitions (more restricted than admin)
    const allowedTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
      returned: [],
    };

    if (!allowedTransitions[order.status]?.includes(newStatus)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot change status from "${order.status}" to "${newStatus}"`
      );
    }

    order.status = newStatus;

    if (newStatus === "cancelled") {
      order.cancelledAt = new Date();
      // Restore stock when seller cancels
      await this.restoreOrderStock(order);
    }

    if (newStatus === "delivered") {
      order.deliveredAt = new Date();
      // Mark as paid for COD orders
      if (order.paymentMethod === "cod" && order.paymentStatus === "unpaid") {
        order.paymentStatus = "paid";
      }
    }

    await order.save();
    return order;
  }

  /**
   * Restore stock when order is cancelled
   * @param {Object} order - Order object
   */
  async restoreOrderStock(order) {
    const inventoryItems = order.products.map(item => ({
        productId: item.productId,
        modelId: item.modelId,
        quantity: item.quantity
    }));

    await inventoryService.restoreStock(inventoryItems);
  }

  /**
   * Get order statistics for a specific shop
   * @param {string} shopId - Shop ID
   * @returns {Promise<Object>} Shop's order statistics
   */
  async getSellerOrderStatistics(shopId) {
    const shopObjectId = new Types.ObjectId(shopId);

    // 1. Orders count by status
    const ordersByStatus = await Order.aggregate([
      { $match: { shopId: shopObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const statusStats = {};
    ordersByStatus.forEach((item) => {
      statusStats[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
      };
    });

    // 2. Revenue statistics (only paid orders)
    const revenueStats = await Order.aggregate([
      {
        $match: {
          shopId: shopObjectId,
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

    // 3. Daily orders for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyOrders = await Order.aggregate([
      {
        $match: {
          shopId: shopObjectId,
          createdAt: { $gte: thirtyDaysAgo },
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

    // 4. Top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          shopId: shopObjectId,
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
      { $limit: 10 },
    ]);

    // 7. Summary counts - PERFORMANCE FIX: Use single aggregation with $facet
    const summaryCounts = await Order.aggregate([
      { $match: { shopId: shopObjectId } },
      {
        $facet: {
          total: [{ $count: "count" }],
          pending: [
            { $match: { status: "pending" } },
            { $count: "count" }
          ],
          completed: [
            { $match: { status: "delivered" } },
            { $count: "count" }
          ],
          cancelled: [
            { $match: { status: "cancelled" } },
            { $count: "count" }
          ]
        }
      }
    ]);

    const counts = summaryCounts[0] || {};
    const totalOrders = counts.total?.[0]?.count || 0;
    const pendingOrders = counts.pending?.[0]?.count || 0;
    const completedOrders = counts.completed?.[0]?.count || 0;
    const cancelledOrders = counts.cancelled?.[0]?.count || 0;

    return {
      summary: {
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0),
      },
      ordersByStatus: statusStats,
      dailyOrders: dailyOrders.map((item) => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
        orders: item.orders,
        revenue: item.revenue,
      })),
      topProducts,
    };
  }

  /**
   * Get all orders in the system (Admin only)
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.shop] - Filter by shop ID
   * @param {string} [filters.status] - Filter by order status
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=20] - Items per page
   * @returns {Promise<Object>} All orders with pagination
   */
  async getAllOrders(filters = {}) {
    const { shop, status, page = 1, limit = 20 } = filters;

    const query = {};
    if (shop) {
      query.shopId = shop;
    }
    if (status && status !== "all") {
      query.status = status;
    }

    const total = await Order.countDocuments(query);
    const paginationParams = getPaginationParams(page, limit, total);

    const orders = await Order.find(query)
      .populate("userId", "username email")
      .populate("shopId", "name logo slug")
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return buildPaginationResponse(orders, paginationParams);
  }

  /**
   * Get order by ID with authorization check
   * @param {string} orderId - Order ID
   * @param {string} userId - Requesting user's ID
   * @param {boolean} isAdmin - Whether user is admin
   * @returns {Promise<Object>} Order object
   * @throws {Error} If order not found or unauthorized
   */
  async getOrderById(orderId, userId, isAdmin = false) {
    const order = await Order.findById(orderId)
      .populate("shopId", "name logo slug") // Added slug for admin panel
      .populate("products.productId", "name slug images")
      .lean();

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
    }

    // Authorization check: user can only view their own orders unless admin
    if (!isAdmin && order.userId.toString() !== userId.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Unauthorized to view this order"
      );
    }

    return order;
  }

  /**
   * Update order status with authorization check (Admin/Seller only)
   * @param {string} orderId - Order ID
   * @param {string} status - New status
   * @param {string} userId - Requesting user's ID
   * @param {boolean} isAdmin - Whether user is admin
   * @param {string} [shopId] - Seller's shop ID (for seller authorization)
   * @returns {Promise<Object>} Updated order
   * @throws {Error} If order not found, unauthorized, or invalid status transition
   */
  async updateOrderStatus(orderId, status, userId, isAdmin = false, shopId = null) {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
    }

    // Authorization check
    if (!isAdmin) {
      // Seller can only update orders for their shop
      if (shopId && order.shopId.toString() !== shopId.toString()) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "Unauthorized to update this order"
        );
      }
      // Regular users cannot update order status
      if (!shopId) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "Unauthorized to update order status"
        );
      }
    }

    // Validate status transition
    const validTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [], // Final state
      cancelled: [], // Final state
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot transition from ${order.status} to ${status}`
      );
    }

    order.status = status;
    if (status === "cancelled") {
      order.cancelledAt = new Date();
    }
    if (status === "delivered") {
      order.deliveredAt = new Date();
    }

    await order.save();
    return order;
  }

  /**
   * Cancel an order and restore stock
   * PERFORMANCE FIX: Batch fetch and update products to avoid N+1 queries
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Cancelled order
   * @throws {Error} If order not found, access denied, or cannot be cancelled
   */
  async cancelOrder(orderId, userId) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Order not found or access denied");
    }

    // Only allow cancel if pending or confirmed
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot cancel order in this status"
      );
    }

    // Restore Stock via InventoryService
    await this.restoreOrderStock(order);

    order.status = "cancelled";
    order.cancelledAt = new Date();
    await order.save();
    return order;
  }

  /**
   * Get comprehensive order statistics for admin dashboard
   * @param {Object} filters - Optional filters
   * @param {Date} [filters.startDate] - Start date for date range
   * @param {Date} [filters.endDate] - End date for date range
   * @returns {Promise<Object>} Order statistics
   */
  async getOrderStatistics(filters = {}) {
    const { startDate, endDate } = filters;
    
    // Build date filter if provided
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // 1. Total orders count by status
    const ordersByStatus = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    // Convert to object for easier access
    const statusStats = {};
    ordersByStatus.forEach(item => {
      statusStats[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount
      };
    });

    // 2. Revenue statistics
    const revenueStats = await Order.aggregate([
      { 
        $match: { 
          ...dateFilter,
          paymentStatus: "paid" 
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$totalAmount" }
        }
      }
    ]);

    // 3. Orders by payment method
    const ordersByPaymentMethod = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    // 4. Daily orders for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0]
            }
          }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    // 5. Top selling products
    const topProducts = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: "cancelled" } } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          productName: { $first: "$products.name" },
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: { $sum: "$products.totalPrice" }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // 6. Orders by shop (for multi-vendor)
    const ordersByShop = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$shopId",
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "shops",
          localField: "_id",
          foreignField: "_id",
          as: "shop"
        }
      },
      { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          shopId: "$_id",
          shopName: "$shop.name",
          orderCount: 1,
          totalRevenue: 1
        }
      }
    ]);

    // 7. Summary counts - PERFORMANCE FIX: Use single aggregation with $facet
    const adminSummaryCounts = await Order.aggregate([
      { $match: dateFilter },
      {
        $facet: {
          total: [{ $count: "count" }],
          pending: [
            { $match: { status: "pending" } },
            { $count: "count" }
          ],
          completed: [
            { $match: { status: "delivered" } },
            { $count: "count" }
          ],
          cancelled: [
            { $match: { status: "cancelled" } },
            { $count: "count" }
          ]
        }
      }
    ]);

    const adminCounts = adminSummaryCounts[0] || {};
    const totalOrders = adminCounts.total?.[0]?.count || 0;
    const pendingOrders = adminCounts.pending?.[0]?.count || 0;
    const completedOrders = adminCounts.completed?.[0]?.count || 0;
    const cancelledOrders = adminCounts.cancelled?.[0]?.count || 0;

    return {
      summary: {
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0)
      },
      ordersByStatus: statusStats,
      ordersByPaymentMethod,
      dailyOrders: dailyOrders.map(item => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        orders: item.orders,
        revenue: item.revenue
      })),
      topProducts,
      ordersByShop
    };
  }
}

module.exports = new OrderService();
