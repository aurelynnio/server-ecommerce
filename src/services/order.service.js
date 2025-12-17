const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Discount = require("../models/discount.model");
const User = require("../models/user.model"); // Added
const Notification = require("../models/notification.model"); // Added
const { getIO } = require("../socket/index"); // Added
const notificationService = require("./notification.service");
const { getPaginationParams } = require("../utils/pagination");

/**
 * Service handling order processing
 * Manages order creation, status updates, and retrieval
 */
class OrderService {
  /**
   * Create a new order from selected cart items
   * @param {string} userId - The ID of the user placing the order
   * @param {Object} orderData - Order details
   * @param {string[]} orderData.cartItemIds - List of cart item IDs to checkout
   * @param {Object} orderData.shippingAddress - Shipping address details
   * @param {string} [orderData.paymentMethod] - Payment method (cod/vnpay)
   * @param {string} [orderData.discountCode] - Discount code to apply
   * @param {string} [orderData.note] - Order note
   * @returns {Promise<Object>} Created order object
   * @throws {Error} If cart is empty, items invalid, or stock insufficient
   */
  async createOrder(userId, orderData) {
    const {
      cartItemIds,
      shippingAddress,
      paymentMethod = "cod",
      discountCode,
      note,
    } = orderData;

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // Filter items to checkout - only selected items
    const itemsToCheckout = cart.items.filter((item) =>
      cartItemIds.includes(item._id.toString())
    );

    if (itemsToCheckout.length === 0) {
      throw new Error("No valid cart items found for checkout");
    }

    if (itemsToCheckout.length !== cartItemIds.length) {
      throw new Error("Some cart items not found in your cart");
    }

    // Prepare order products with snapshot data
    const orderProducts = [];
    let subtotal = 0;

    for (const item of itemsToCheckout) {
      const product = item.productId;

      if (!product || !product.isActive) {
        throw new Error(
          `Product ${product?.name || "unknown"} is not available`
        );
      }

      // Get variant info if exists
      let variantInfo = {};
      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant) {
          throw new Error(`Variant not found for product ${product.name}`);
        }
        if (variant.stock < item.quantity) {
          throw new Error(
            `Only ${variant.stock} items available for ${product.name} (${variant.color} - ${variant.size})`
          );
        }
        variantInfo = {
          variantId: variant._id,
          sku: variant.sku,
          color: variant.color,
          size: variant.size,
        };
      }

      // Calculate item price
      const itemPrice = item.price.discountPrice || item.price.currentPrice;
      subtotal += itemPrice * item.quantity;

      // Add product to order
      orderProducts.push({
        productId: product._id,
        name: product.name,
        image: product.images[0] || "",
        quantity: item.quantity,
        price: item.price,
        ...variantInfo,
      });
    }

    // Apply discount if provided
    let discountAmount = 0;
    let validDiscountCode = null;
    let discountId = null;

    if (discountCode) {
      const discount = await Discount.findOne({
        code: discountCode.toUpperCase(),
      });

      if (!discount) {
        throw new Error("Invalid discount code");
      }

      // Validate discount
      if (!discount.isActive) {
        throw new Error("Discount code is not active");
      }

      const now = new Date();
      if (now < discount.startDate || now > discount.endDate) {
        throw new Error("Discount code is expired or not yet valid");
      }

      if (discount.usedCount >= discount.usageLimit) {
        throw new Error("Discount code usage limit reached");
      }

      if (subtotal < discount.minOrderValue) {
        throw new Error(
          `Minimum order value of ${discount.minOrderValue.toLocaleString()} VND required`
        );
      }

      // Check applicable products
      if (discount.applicableProducts.length > 0) {
        const orderProductIds = orderProducts.map((p) =>
          p.productId.toString()
        );
        const hasApplicableProduct = orderProductIds.some((productId) =>
          discount.applicableProducts.some(
            (applicableId) => applicableId.toString() === productId
          )
        );

        if (!hasApplicableProduct) {
          throw new Error("Discount not applicable to selected products");
        }
      }

      // Calculate discount amount
      if (discount.discountType === "percent") {
        discountAmount = (subtotal * discount.discountValue) / 100;
      } else {
        discountAmount = discount.discountValue;
      }

      // Ensure discount doesn't exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal);
      discountAmount = Math.round(discountAmount);

      validDiscountCode = discount.code;
      discountId = discount._id;
    }

    // Calculate total amount
    const totalAmount = subtotal - discountAmount;

    // Create order
    const order = await Order.create({
      userId,
      products: orderProducts,
      shippingAddress: {
        ...shippingAddress,
        note: note || shippingAddress.note || "",
      },
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "unpaid" : "unpaid",
      subtotal,
      discountCode: validDiscountCode,
      discountAmount,
      totalAmount,
      status: "pending",
    });

    // Update product soldCount and stock
    for (const item of itemsToCheckout) {
      const product = await Product.findById(item.productId);
      if (product) {
        // Increase soldCount
        product.soldCount = (product.soldCount || 0) + item.quantity;

        // Decrease variant stock if exists
        if (item.variantId) {
          const variant = product.variants.id(item.variantId);
          if (variant) {
            variant.stock -= item.quantity;
          }
        }

        await product.save();
      }
    }

    // Increment discount usage count if discount was applied
    if (discountId) {
      await Discount.findByIdAndUpdate(discountId, {
        $inc: { usedCount: 1 },
      });
    }

    // Remove checked out items from cart
    cart.items = cart.items.filter(
      (item) => !cartItemIds.includes(item._id.toString())
    );

    // Recalculate cart total
    cart.totalAmount = cart.items.reduce(
      (total, item) =>
        total +
        (item.price.discountPrice || item.price.currentPrice) * item.quantity,
      0
    );
    await cart.save();

    // Populate order data
    await order.populate("userId", "username email");

    // Notify all Admins
    try {
        const admins = await User.find({ roles: "admin" }).select("_id");
        if (admins.length > 0) {
            const adminNotis = admins.map(admin => ({
                userId: admin._id,
                type: "order_status", 
                title: "Đơn hàng mới",
                message: `Khách hàng ${order.userId.username} vừa đặt đơn #${order._id.toString().slice(-6).toUpperCase()}`,
                orderId: order._id,
                link: `/admin/orders/${order._id}`
            }));

            await Notification.insertMany(adminNotis);
            
            const io = getIO();
            
            // Emit generic new_order event for dashboards
            io.emit("new_order", {
                orderId: order._id,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt
            });

            admins.forEach(admin => {
                 const noti = adminNotis.find(n => n.userId.toString() === admin._id.toString());
                 if (noti) {
                    io.to(admin._id.toString()).emit("new_notification", {
                        ...noti,
                        createdAt: new Date(),
                        isRead: false
                    });
                 }
            });
        }
    } catch (e) { console.error("Admin alert error:", e.message); }

    return order;
  }

  // Get all orders with filters (Admin)
  async getAllOrders(filters = {}) {
    const { page = 1, limit = 10, status, paymentStatus, userId } = filters;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (userId) {
      query.userId = userId;
    }

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Calculate pagination parameters
    const paginationParams = getPaginationParams(page, limit, total);

    // Fetch orders
    const orders = await Order.find(query)
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return {
      data: orders,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalItems: paginationParams.totalItems,
        totalPages: paginationParams.totalPages,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  // Get user's orders
  async getUserOrders(userId, filters = {}) {
    const { page = 1, limit = 10, status } = filters;

    const query = { userId };

    if (status) {
      query.status = status;
    }

    // Get total count
    const total = await Order.countDocuments(query);

    // Calculate pagination
    const paginationParams = getPaginationParams(page, limit, total);

    // Fetch orders
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(paginationParams.skip)
      .limit(paginationParams.limit)
      .lean();

    return {
      data: orders,
      pagination: {
        currentPage: paginationParams.currentPage,
        pageSize: paginationParams.pageSize,
        totalItems: paginationParams.totalItems,
        totalPages: paginationParams.totalPages,
        hasNextPage: paginationParams.hasNextPage,
        hasPrevPage: paginationParams.hasPrevPage,
        nextPage: paginationParams.nextPage,
        prevPage: paginationParams.prevPage,
      },
    };
  }

  // Get single order by ID
  async getOrderById(orderId, userId = null, isAdmin = false) {
    const order = await Order.findById(orderId)
      .populate("userId", "username email phone")
      .lean();

    if (!order) {
      throw new Error("Order not found");
    }

    // Check permission: user can only view their own orders unless admin
    if (!isAdmin && userId && order.userId._id.toString() !== userId) {
      throw new Error("Unauthorized to view this order");
    }

    return order;
  }

  // Update order status (Admin)
  async updateOrderStatus(orderId, status) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Validate status transition
    const validTransitions = {
      pending: ["confirmed", "processing", "shipped", "delivered", "cancelled"],
      confirmed: ["processing", "shipped", "delivered", "cancelled"],
      processing: ["shipped", "delivered", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new Error(`Cannot change status from ${order.status} to ${status}`);
    }

    order.status = status;

    // Set deliveredAt if status is delivered
    if (status === "delivered") {
      order.deliveredAt = new Date();
      order.paymentStatus = "paid"; // Auto mark as paid when delivered (for COD)
    }

    await order.save();

    await order.populate("userId", "username email");

    return order;
  }

  // Cancel order (User or Admin)
  async cancelOrder(orderId, userId = null, isAdmin = false) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Check permission
    if (!isAdmin && order.userId.toString() !== userId) {
      throw new Error("Unauthorized to cancel this order");
    }

    // Only allow cancellation if order is pending or confirmed
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new Error("Cannot cancel order at this stage");
    }

    // Restore product stock if order has variants
    for (const item of order.products) {
      if (item.variantId) {
        const product = await Product.findById(item.productId);
        if (product) {
          const variant = product.variants.id(item.variantId);
          if (variant) {
            variant.stock += item.quantity;
            // Decrease soldCount
            product.soldCount = Math.max(
              0,
              (product.soldCount || 0) - item.quantity
            );
            await product.save();
          }
        }
      }
    }

    // Restore discount usage count if discount was used
    if (order.discountCode) {
      await Discount.findOneAndUpdate(
        { code: order.discountCode },
        { $inc: { usedCount: -1 } }
      );
    }

    order.status = "cancelled";
    await order.save();

    return order;
  }

  // Get order statistics (Admin)
  async getOrderStatistics() {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    return {
      ordersByStatus: stats,
      totalRevenue: totalRevenue[0]?.total || 0,
    };
  }
}

module.exports = new OrderService();
