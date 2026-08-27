const Order = require('../repositories/order.repository');
const Cart = require('../repositories/cart.repository');
const Product = require('../repositories/product.repository');
const { Types } = require('mongoose');
const mongoose = require('mongoose');
const inventoryService = require('./inventory.service');
const voucherService = require('./voucher.service');
const Voucher = require('../repositories/voucher.repository');
const VoucherUsage = require('../repositories/voucher-usage.repository');
const User = require('../repositories/user.repository');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { ORDER_ACTORS, canTransition } = require('../shared/order/orderState');
const { config_rabbitMQ, connectRabbitMQ } = require('../configs/rabbitMQ.config');

const MAX_TX_RETRIES = Number(process.env.TXN_MAX_RETRIES) || 3;
const TX_RETRY_DELAY_MS = Number(process.env.TXN_RETRY_DELAY_MS) || 50;
const ORDER_EVENT_TYPES = {
  CREATED: 'order.created',
  STATUS_CHANGED: 'order.status_changed',
};
const SYSTEM_ORDER_ACTOR = 'system';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toObjectIdString = (value) => (value ? value.toString() : null);
const getOrderCode = (order) => order.orderNumber || order._id.toString().slice(-6).toUpperCase();
const toFiniteNumber = (value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const requireFiniteNumber = (value, message) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, message);
  }
  return parsed;
};
const sanitizeAddressField = (value) => (typeof value === 'string' ? value.trim() : '');
const buildShippingAddressSnapshot = (address, note = '') => {
  const snapshot = {
    fullName: sanitizeAddressField(address?.fullName),
    phone: sanitizeAddressField(address?.phone),
    address: sanitizeAddressField(address?.address),
    city: sanitizeAddressField(address?.city),
    district: sanitizeAddressField(address?.district),
    ward: sanitizeAddressField(address?.ward),
    note: sanitizeAddressField(note),
  };

  if (
    !snapshot.fullName ||
    !snapshot.phone ||
    !snapshot.address ||
    !snapshot.city ||
    !snapshot.district ||
    !snapshot.ward
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Selected shipping address is incomplete. Please update your profile address.',
    );
  }

  return snapshot;
};

const getErrorLabels = (error) => error?.errorLabels || error?.result?.errorLabels || [];

const isRetryableTransactionError = (error) =>
  getErrorLabels(error).includes('TransientTransactionError');

const isUnknownCommitResult = (error) =>
  getErrorLabels(error).includes('UnknownTransactionCommitResult');

/**
 * Service handling order operations
 * Manages order creation, retrieval, status updates, and statistics
 */
class OrderService {
  async initRabbitMQ(clientName = 'publisher') {
    return connectRabbitMQ('order', { confirm: true, clientName: clientName });
  }

  async publishToQueue({
    clientName,
    queueName,
    content,
    headers = {},
    bufferWarningMessage,
    confirmErrorMessage,
    successMessage,
    successMeta = {},
  }) {
    const { channel } = await this.initRabbitMQ(clientName);
    const queueContent = Buffer.isBuffer(content) ? content : Buffer.from(JSON.stringify(content));
    let isBuffered;
    try {
      isBuffered = await channel.sendToQueue(queueName, queueContent, {
        persistent: true,
        contentType: 'application/json',
        headers,
      });
    } catch (error) {
      logger.error(confirmErrorMessage, { error: error.message, queue: queueName, ...successMeta });
      throw error;
    }
    if (!isBuffered) {
      logger.warn(bufferWarningMessage, {
        queue: queueName,
      });
    }
    logger.info(successMessage, { queue: queueName, ...successMeta });
    return {
      published: isBuffered,
      queue: queueName,
      ...successMeta,
    };
  }

  async publishOrder(payload, routingKey) {
    const { channel } = await this.initRabbitMQ('publisher');
    const content = Buffer.from(JSON.stringify(payload));
    const exchange = config_rabbitMQ.exchange.name;

    if (!routingKey.startsWith('order.')) {
      logger.warn('Unexpected routing key format for order message', { routingKey: routingKey });
    }
    try {
      await channel.publish(exchange, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
      });
    } catch (error) {
      logger.error('Failed to confirm order message', {
        error: error.message,
        routingKey,
        userId: payload.userId,
      });
    }
  }

  async publishOrderRetry(content, retryCount) {
    const retryQueue = config_rabbitMQ.queues.order.retryQueue;
    return this.publishToQueue({
      clientName: 'retry-publisher',
      queueName: retryQueue,
      content,
      headers: {
        'x-retry-count': retryCount,
      },
      bufferWarningMessage: 'RabbitMQ queue buffer is full for order retry queue',
      confirmErrorMessage: 'Failed to confirm order retry message',
      successMessage: 'Order message sent to retry queue',
      successMeta: { retryCount },
    });
  }

  async publishOrderFailed(content, retryCount) {
    const failedQueue = config_rabbitMQ.queues.order.failedQueue;
    return this.publishToQueue({
      clientName: 'failed-publisher',
      queueName: failedQueue,
      content,
      headers: {
        'x-retry-count': retryCount,
        'x-final-failure-reason': 'max_retries_exceeded',
      },
      bufferWarningMessage: 'RabbitMQ queue buffer is full for order final failed queue',
      confirmErrorMessage: 'Failed to confirm final failed order message ',
      successMessage: 'Order message sent to failed queue',
      successMeta: { retryCount },
    });
  }

  buildOrderEventPayload(order, extra = {}) {
    return {
      orderId: toObjectIdString(order._id),
      orderGroupId: toObjectIdString(order.orderGroupId),
      orderCode: getOrderCode(order),
      userId: toObjectIdString(order.userId),
      shopId: toObjectIdString(order.shopId),
      status: order.status,
      paymentStatus: order.paymentStatus || 'unpaid',
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      customerName: order.shippingAddress?.fullName || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      ...extra,
    };
  }

  async publishOrderEvent(eventName, payload) {
    return this.publishOrder(
      {
        eventName,
        ...payload,
      },
      eventName,
    );
  }

  async publishOrderCreatedEvents(orders) {
    await Promise.all(
      orders.map((order) =>
        this.publishOrderEvent(ORDER_EVENT_TYPES.CREATED, this.buildOrderEventPayload(order)),
      ),
    );
  }

  async publishOrderStatusChangedEvent(
    order,
    previousStatus,
    actor = SYSTEM_ORDER_ACTOR,
    extra = {},
  ) {
    return this.publishOrderEvent(
      ORDER_EVENT_TYPES.STATUS_CHANGED,
      this.buildOrderEventPayload(order, {
        previousStatus,
        actor,
        ...extra,
      }),
    );
  }
  /**
   * Create orders from cart items with transaction support
   * Splits items by shop and creates separate orders per shop
   * @param {string} userId - User ID placing the order
   * @param {Object} orderData - Order details
   * @param {string[]} orderData.cartItemIds - Cart item IDs to checkout
   * @param {string} orderData.addressId - User address ID selected for delivery
   * @param {string} [orderData.paymentMethod="cod"] - Payment method
   * @param {Array} [orderData.shopVouchers] - Shop-specific vouchers [{shopId, code}]
   * @param {string} [orderData.platformVoucher] - Platform voucher code
   * @param {string} [orderData.note] - Order note
   * @returns {Promise<Object>} Created orders with group ID
   * @throws {Error} If cart is empty, items unavailable, or out of stock
   */
  async createOrder(userId, orderData) {
    const orderGroupId = new Types.ObjectId();

    for (let attempt = 0; attempt <= MAX_TX_RETRIES; attempt++) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        const {
          cartItemIds,
          addressId,
          paymentMethod = 'cod',
          shopVouchers = [], // Array of { shopId, code }
          platformVoucher, // String (code)
          note,
        } = orderData;

        const user = await User.findByIdWithAddresses(userId).session(session);
        if (!user) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
        }

        const selectedAddress = user.addresses?.id(addressId);
        if (!selectedAddress) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            'Shipping address not found for current user',
          );
        }

        const shippingAddress = buildShippingAddressSnapshot(selectedAddress, note);

        // 1. Get Selected Items from Cart
        const cart = await Cart.findByUserIdForCheckout(userId, session);
        if (!cart) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'Cart is empty');
        }

        const itemsToCheckout = cart.items.filter((item) =>
          cartItemIds.includes(item._id.toString()),
        );

        if (itemsToCheckout.length === 0) {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'No items selected');
        }

        // 2. Group items by Shop
        const shopItemsMap = new Map(); // shopId -> [items]

        for (const item of itemsToCheckout) {
          const product = item.productId;
          if (!product) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Product info missing');
          }

          // Ensure shopId is available
          let shopId = item.shopId;
          if (!shopId && product.shop) shopId = product.shop;

          if (!shopId) {
            throw new ApiError(
              StatusCodes.UNPROCESSABLE_ENTITY,
              `Product ${product.name} has no shop`,
            );
          }

          const shopIdStr = shopId.toString();
          if (!shopItemsMap.has(shopIdStr)) {
            shopItemsMap.set(shopIdStr, []);
          }
          shopItemsMap.get(shopIdStr).push(item);
        }

        // 3. Create Orders per Shop
        const createdOrders = [];
        let totalPlatformOrderValue = 0; // To check platform voucher condition

        // Temporary storage for created orders to update them later with Platform Discount
        const tempOrders = [];

        for (const [shopId, items] of shopItemsMap.entries()) {
          const orderProducts = [];
          let subtotal = 0;
          const inventoryItems = [];

          // Batch fetch products to optimize performance
          const productIds = items.map((item) => item.productId._id);
          const products = await Product.findByIds(productIds).session(session);
          const productMap = new Map(products.map((p) => [p._id.toString(), p]));

          // Verify Price & Build Inventory List
          for (const item of items) {
            const product = productMap.get(item.productId._id.toString());
            if (!product || product.status !== 'published') {
              throw new ApiError(StatusCodes.CONFLICT, `${item.productId.name} unavailable`);
            }

            const quantity = requireFiniteNumber(
              item.quantity,
              `Invalid quantity for product ${product.name}`,
            );
            if (!Number.isInteger(quantity) || quantity < 1) {
              throw new ApiError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                `Invalid quantity for product ${product.name}`,
              );
            }

            let price = requireFiniteNumber(
              product.price?.currentPrice,
              `Invalid base price for product ${product.name}`,
            );
            let skuCode = '';

            if (item.modelId) {
              const variant = product.variants?.find(
                (v) => v._id.toString() === item.modelId.toString(),
              );

              if (!variant) {
                throw new ApiError(
                  StatusCodes.NOT_FOUND,
                  `Variation for ${product.name} no longer exists`,
                );
              }

              // Note: Stock check is now handled by inventoryService.deductStock

              price = requireFiniteNumber(
                variant.price,
                `Invalid variant price for product ${product.name}`,
              );
              skuCode = variant.sku;

              inventoryItems.push({
                productId: product._id,
                modelId: item.modelId,
                quantity,
              });
            } else {
              // Base product
              inventoryItems.push({
                productId: product._id,
                quantity,
              });
            }

            const lineTotal = price * quantity;
            subtotal += lineTotal;

            orderProducts.push({
              productId: product._id,
              sku: skuCode,
              variantId: item.modelId,
              name: product.name, // Snapshot name
              image: product.images?.[0] || '', // simplified
              quantity,
              price,
              totalPrice: lineTotal,
            });
          }

          await inventoryService.checkStockAvailability(inventoryItems);

          // --- DEDUCT STOCK (via InventoryService) ---
          await inventoryService.deductStock(inventoryItems, session);

          // --- APPLY SHOP VOUCHER ---
          let discountShop = 0;
          const appliedVouchers = [];
          let shopVoucherResult = null;
          const shopVoucherEntry = shopVouchers.find((v) => v.shopId === shopId);
          if (shopVoucherEntry) {
            const voucherResult = await voucherService.applyVoucher(
              shopVoucherEntry.code,
              userId,
              subtotal,
              shopId,
            );
            discountShop = requireFiniteNumber(
              voucherResult.discountAmount,
              `Invalid shop voucher discount for shop ${shopId}`,
            );

            // Snapshot voucher áp dụng để rollback usage khi hủy đơn
            appliedVouchers.push({
              voucherId: voucherResult.voucherId,
              code: voucherResult.code,
              scope: 'shop',
              discountAmount: discountShop,
            });
            shopVoucherResult = voucherResult;

            // Increment usage count
            await Voucher.updateById(
              voucherResult.voucherId,
              { $inc: { usageCount: 1 } },
              { session },
            );
          }

          const totalAmount = Math.max(0, subtotal - discountShop);
          totalPlatformOrderValue += totalAmount; // Platform discount applies on total after shop discount

          // 4. Create Order Object (Not save yet)
          const newOrder = Order.build({
            orderGroupId,
            userId,
            shopId,
            products: orderProducts,
            shippingAddress,
            paymentMethod,
            subtotal,
            discountShop,
            discountPlatform: 0,
            appliedVouchers,
            totalAmount, // Temporary, will subtract platform discount later
            status: 'pending',
          });

          // Record shop voucher usage gắn với orderId để rollback chính xác khi hủy đơn
          if (shopVoucherResult) {
            await VoucherUsage.create(
              [{ voucherId: shopVoucherResult.voucherId, userId, orderId: newOrder._id }],
              { session },
            );
          }

          tempOrders.push(newOrder);
        }

        // --- APPLY PLATFORM VOUCHER (One for all) ---
        if (platformVoucher) {
          const voucherResult = await voucherService.applyVoucher(
            platformVoucher,
            userId,
            totalPlatformOrderValue,
          );

          const totalPlatformDiscount = requireFiniteNumber(
            voucherResult.discountAmount,
            'Invalid platform voucher discount',
          );

          if (totalPlatformOrderValue > 0 && totalPlatformDiscount > 0) {
            // Distribute platform discount to each order proportionally
            // Weight = Order.totalAmount / totalPlatformOrderValue
            let distributedDiscount = 0;

            tempOrders.forEach((order, index) => {
              if (index === tempOrders.length - 1) {
                // Last order takes the remainder to handle rounding issues
                order.discountPlatform = Math.max(0, totalPlatformDiscount - distributedDiscount);
              } else {
                const ratio = order.totalAmount / totalPlatformOrderValue;
                const portion = Math.floor(totalPlatformDiscount * ratio);
                order.discountPlatform = requireFiniteNumber(
                  portion,
                  'Invalid platform discount distribution',
                );
                distributedDiscount += order.discountPlatform;
              }

              order.totalAmount = Math.max(0, order.totalAmount - order.discountPlatform);
            });
          } else {
            tempOrders.forEach((order) => {
              order.discountPlatform = 0;
              order.totalAmount = Math.max(0, order.totalAmount);
            });
          }

          // Snapshot platform voucher lên từng đơn trong group để rollback khi hủy
          tempOrders.forEach((order) => {
            order.appliedVouchers.push({
              voucherId: voucherResult.voucherId,
              code: voucherResult.code,
              scope: 'platform',
              discountAmount: order.discountPlatform,
            });
          });

          // Increment usage count; usage record gắn orderGroupId vì voucher dùng chung cả group
          await Voucher.updateById(
            voucherResult.voucherId,
            { $inc: { usageCount: 1 } },
            { session },
          );
          await VoucherUsage.create(
            [{ voucherId: voucherResult.voucherId, userId, orderGroupId }],
            { session },
          );
        }

        for (const order of tempOrders) {
          await order.save({ session });
          createdOrders.push(order);
        }

        // 5. Cleanup Cart
        cart.items = cart.items.filter((item) => !cartItemIds.includes(item._id.toString()));
        cart.totalAmount = this.calculateTotal(cart.items);
        await cart.save({ session });

        await session.commitTransaction();
        await this.publishOrderCreatedEvents(createdOrders);

        return {
          message: 'Orders created successfully',
          orderGroupId,
          orders: createdOrders,
        };
      } catch (error) {
        // Abort transaction on error - all changes will be rolled back
        try {
          await session.abortTransaction();
        } catch {
          // no-op
        }

        if (isUnknownCommitResult(error)) {
          const existingOrders = await Order.findByOrderGroupIdLean(orderGroupId);
          if (existingOrders.length > 0) {
            await this.publishOrderCreatedEvents(existingOrders);
            return {
              message: 'Orders created successfully',
              orderGroupId,
              orders: existingOrders,
            };
          }
        }

        const canRetry = isRetryableTransactionError(error) || isUnknownCommitResult(error);

        if (canRetry && attempt < MAX_TX_RETRIES) {
          await sleep(TX_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        throw error;
      } finally {
        session.endSession();
      }
    }

    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create order after retries');
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
  async getUserOrders(userId, _filters = {}) {
    const orders = await Order.findByUserIdWithShopAndProducts(userId);
    return { data: orders }; // Unified response structure
  }

  /**
   * Get all orders for a shop (Seller dashboard)
   * @param {string} shopId - Shop ID
   * @param {Object} [filters] - Optional filters (unused, for future expansion)
   * @returns {Promise<Object>} Shop's orders
   */
  async getShopOrders(shopId, _filters = {}) {
    const orders = await Order.findByShopIdWithUser(shopId);
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

    const filterArgs = { status, paymentStatus };
    const total = await Order.countByShopWithFilters(shopId, filterArgs);
    const paginationParams = getPaginationParams(page, limit, total);

    const orders = await Order.findByShopWithFilters(shopId, filterArgs, paginationParams);

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
    // Hủy đơn: chạy atomic (transaction) vì phải hoàn stock + rollback voucher
    if (newStatus === 'cancelled') {
      return this._cancelOrderAtomically(async (session) => {
        const order = await Order.findByIdAndShop(orderId, shopId).session(session);
        if (!order) {
          throw new ApiError(
            StatusCodes.NOT_FOUND,
            "Order not found or doesn't belong to your shop",
          );
        }
        return order;
      }, ORDER_ACTORS.SELLER);
    }

    const order = await Order.findByIdAndShop(orderId, shopId);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Order not found or doesn't belong to your shop");
    }

    if (!canTransition(order.status, newStatus, ORDER_ACTORS.SELLER)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot change status from "${order.status}" to "${newStatus}"`,
      );
    }

    const previousStatus = order.status;
    order.status = newStatus;

    if (newStatus === 'delivered') {
      order.deliveredAt = new Date();
      // Mark as paid for COD orders
      if (order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
        order.paymentStatus = 'paid';
      }
    }

    await order.save();
    await this.publishOrderStatusChangedEvent(order, previousStatus, ORDER_ACTORS.SELLER);
    return order;
  }

  /**
   * Restore stock when order is cancelled
   * @param {Object} order - Order object
   * @param {Object} [session] - Mongoose session (đảm bảo atomic với việc đổi trạng thái đơn)
   */
  async restoreOrderStock(order, session = null) {
    const inventoryItems = order.products.map((item) => ({
      productId: item.productId,
      modelId: item.variantId,
      quantity: item.quantity,
    }));

    await inventoryService.restoreStock(inventoryItems, session);
  }

  /**
   * Hủy đơn atomically trong 1 MongoDB transaction: hoàn stock + set trạng thái
   * cancelled + commit cùng nhau. Write conflict của transaction đảm bảo 2 request
   * hủy concurrent cùng 1 đơn không hoàn stock 2 lần (request thua bị abort/retry
   * và thấy đơn đã hủy rồi).
   *
   * Voucher rollback + event publish chạy SAU commit: rollback usage là idempotent
   * (delete-first), còn RabbitMQ publish thì không rollback được nếu nằm trong tx.
   *
   * @param {(session: Object) => Promise<Object>} loadOrder - Load order kèm
   *        authorization check riêng cho từng actor (user/seller/admin).
   *        Throw ApiError nếu không hợp lệ.
   * @param {string} actor - ORDER_ACTORS.USER | SELLER | ADMIN
   * @returns {Promise<Object>} Order đã hủy
   */
  async _cancelOrderAtomically(loadOrder, actor) {
    let committed = null;

    for (let attempt = 0; attempt <= MAX_TX_RETRIES; attempt++) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        const order = await loadOrder(session);
        const previousStatus = order.status;

        if (!canTransition(order.status, 'cancelled', actor)) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            `Cannot change status from "${order.status}" to "cancelled"`,
          );
        }

        await this.restoreOrderStock(order, session);
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        await order.save({ session });

        await session.commitTransaction();
        committed = { order, previousStatus };
        break;
      } catch (error) {
        try {
          await session.abortTransaction();
        } catch {
          // no-op
        }

        const canRetry =
          isRetryableTransactionError(error) || isUnknownCommitResult(error);
        if (canRetry && attempt < MAX_TX_RETRIES) {
          await sleep(TX_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw error;
      } finally {
        session.endSession();
      }
    }

    if (!committed) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to cancel order after retries');
    }

    const { order, previousStatus } = committed;

    // Đơn đã thanh toán online bị hủy → không có flow refund tự động,
    // log để ops xử lý hoàn tiền thủ công (payment record vẫn 'completed')
    if (order.paymentStatus === 'paid') {
      logger.warn('[Order] Cancelled order was already paid online — manual refund required', {
        orderId: order._id.toString(),
        actor,
        previousStatus,
      });
    }

    // Post-commit: rollback voucher usage (idempotent) + notify
    await this.rollbackOrderVouchers(order);
    await this.publishOrderStatusChangedEvent(order, previousStatus, actor);
    return order;
  }

  /**
   * Rollback usage các voucher đã áp dụng khi hủy đơn:
   * - Voucher shop: usage gắn 1:1 với đơn → rollback ngay
   * - Voucher platform: dùng chung cho cả order group → chỉ rollback khi
   *   TẤT CẢ đơn trong group đã bị hủy (còn đơn nào alive thì giữ usage)
   * - Đơn tạo trước khi có appliedVouchers → no-op (tương thích dữ liệu cũ)
   * @param {Object} order - Order document đang được hủy
   */
  async rollbackOrderVouchers(order) {
    const applied = order.appliedVouchers || [];
    if (applied.length === 0) return;

    for (const appliedVoucher of applied) {
      if (appliedVoucher.scope === 'platform') {
        // Thiếu orderGroupId → không định vị được usage record, skip để tránh rollback sai
        if (!order.orderGroupId) continue;

        const remainingOrders = await Order.countActiveOrdersInGroupExcluding(
          order.orderGroupId,
          order._id,
        );
        if (remainingOrders > 0) continue;

        await voucherService.rollbackVoucherUsage(appliedVoucher.voucherId, order.userId, {
          orderGroupId: order.orderGroupId,
        });
      } else {
        await voucherService.rollbackVoucherUsage(appliedVoucher.voucherId, order.userId, {
          orderId: order._id,
        });
      }
    }
  }

  /**
   * Get order statistics for a specific shop
   * @param {string} shopId - Shop ID
   * @returns {Promise<Object>} Shop's order statistics
   */
  async getSellerOrderStatistics(shopId) {
    const shopObjectId = new Types.ObjectId(shopId);

    // 1. Orders count by status
    const ordersByStatus = await Order.aggregateSellerOrdersByStatus(shopObjectId);

    const statusStats = {};
    ordersByStatus.forEach((item) => {
      statusStats[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
      };
    });

    // 2. Revenue statistics (only paid orders)
    const revenueStats = await Order.aggregateSellerRevenueStats(shopObjectId);

    // 3. Daily orders for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyOrders = await Order.aggregateSellerDailyOrders(shopObjectId, thirtyDaysAgo);

    // 4. Top selling products
    const topProducts = await Order.aggregateSellerTopProducts(shopObjectId, 10);

    // 7. Summary counts - compute all counters in one aggregation pass
    const summaryCounts = await Order.aggregateSellerSummaryCounts(shopObjectId);

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
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
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
    const { shop, status, paymentStatus, paymentMethod, userId, page = 1, limit = 20 } = filters;

    const filterArgs = { shop, status, paymentStatus, paymentMethod, userId };
    const total = await Order.countAllWithFilters(filterArgs);
    const paginationParams = getPaginationParams(page, limit, total);

    const orders = await Order.findAllWithFilters(filterArgs, paginationParams);

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
    const order = await Order.findByIdWithShopAndProducts(orderId);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
    }

    // Authorization check: user can only view their own orders unless admin
    if (!isAdmin && order.userId.toString() !== userId.toString()) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to view this order');
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
    const actor = isAdmin ? ORDER_ACTORS.ADMIN : ORDER_ACTORS.SELLER;

    // Hủy đơn: chạy atomic (transaction) vì phải hoàn stock + rollback voucher
    if (status === 'cancelled') {
      return this._cancelOrderAtomically(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
        }

        // Authorization check (giống nhánh không hủy)
        if (!isAdmin) {
          if (shopId && order.shopId.toString() !== shopId.toString()) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to update this order');
          }
          if (!shopId) {
            throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to update order status');
          }
        }

        return order;
      }, actor);
    }

    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
    }

    // Authorization check
    if (!isAdmin) {
      // Seller can only update orders for their shop
      if (shopId && order.shopId.toString() !== shopId.toString()) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to update this order');
      }
      // Regular users cannot update order status
      if (!shopId) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to update order status');
      }
    }

    if (!canTransition(order.status, status, actor)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    const previousStatus = order.status;
    order.status = status;
    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();
    await this.publishOrderStatusChangedEvent(order, previousStatus, actor);
    return order;
  }

  /**
   * Cancel an order and restore stock (user path)
   * Stock restore + status change chạy trong 1 transaction (chống hoàn stock
   * 2 lần khi 2 request cancel concurrent, hoặc stock phình nếu save fail).
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<Object>} Cancelled order
   * @throws {Error} If order not found, access denied, or cannot be cancelled
   */
  async cancelOrder(orderId, userId) {
    return this._cancelOrderAtomically(async (session) => {
      const order = await Order.findByIdAndUser(orderId, userId).session(session);
      if (!order) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found or access denied');
      }

      // Đơn đã thanh toán online: không cho user tự hủy vì chưa có flow refund
      // tự động — hướng dẫn liên hệ hỗ trợ để hoàn tiền
      if (order.paymentStatus === 'paid') {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'Đơn hàng đã được thanh toán online. Vui lòng liên hệ hỗ trợ để hủy đơn và hoàn tiền.',
        );
      }

      return order;
    }, ORDER_ACTORS.USER);
  }

  /**
   * Confirm delivery by the buyer.
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delivered order
   */
  async confirmDelivery(orderId, userId) {
    const order = await Order.findByIdAndUser(orderId, userId);
    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found or access denied');
    }

    if (order.status !== 'shipped') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Only shipped orders can be confirmed');
    }

    const previousStatus = order.status;
    order.status = 'delivered';
    order.deliveredAt = new Date();

    if (order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
      order.paymentStatus = 'paid';
    }

    await order.save();
    await this.publishOrderStatusChangedEvent(order, previousStatus, ORDER_ACTORS.USER);
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

    // 1. Total orders count by status
    const ordersByStatus = await Order.aggregateAdminOrdersByStatusInRange(startDate, endDate);

    // Convert to object for easier access
    const statusStats = {};
    ordersByStatus.forEach((item) => {
      statusStats[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
      };
    });

    // 2. Revenue statistics
    const revenueStats = await Order.aggregateAdminRevenueStatsInRange(startDate, endDate);

    // 3. Orders by payment method
    const ordersByPaymentMethod = await Order.aggregateAdminOrdersByPaymentMethodInRange(
      startDate,
      endDate,
    );

    // 4. Daily orders for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyOrders = await Order.aggregateAdminDailyOrders(thirtyDaysAgo);

    // 5. Top selling products
    const topProducts = await Order.aggregateAdminTopProductsInRange(startDate, endDate, 10);

    // 6. Orders by shop (for multi-vendor)
    const ordersByShop = await Order.aggregateAdminOrdersByShopInRange(startDate, endDate, 10);

    // 7. Summary counts - compute all counters in one aggregation pass
    const adminSummaryCounts = await Order.aggregateAdminSummaryCountsInRange(startDate, endDate);

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
        avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0),
      },
      ordersByStatus: statusStats,
      ordersByPaymentMethod,
      dailyOrders: dailyOrders.map((item) => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        orders: item.orders,
        revenue: item.revenue,
      })),
      topProducts,
      ordersByShop,
    };
  }
}

module.exports = new OrderService();
