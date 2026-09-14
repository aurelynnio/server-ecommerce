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
const Shop = require('../repositories/shop.repository');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const redisService = require('./redis.service');
const { ORDER_ACTORS, canTransition } = require('../shared/order/orderState');
const { config_rabbitMQ, connectRabbitMQ } = require('../configs/rabbitMQ.config');
const { publishToRetryQueue, publishToFailedQueue } = require('../utils/rabbitmq.utils');
const {
  distributePlatformDiscount,
  resolveEffectiveItemPrice,
  requireFiniteNumber,
} = require('../utils/discount.util');
const outboxService = require('./outbox.service');

const MAX_TX_RETRIES = Number(process.env.TXN_MAX_RETRIES) || 5;
const TX_RETRY_DELAY_MS = Number(process.env.TXN_RETRY_DELAY_MS) || 100;
const { ORDER_EVENT_TYPES } = require('../shared/order/orderEvents');
const SYSTEM_ORDER_ACTOR = 'system';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toObjectIdString = (value) => (value ? value.toString() : null);
const getOrderCode = (order) => order.orderNumber || order._id.toString().slice(-6).toUpperCase();
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
    postalCode:
      sanitizeAddressField(address?.postalCode) || sanitizeAddressField(address?.postal_code),
    countryCode:
      sanitizeAddressField(address?.countryCode) || sanitizeAddressField(address?.country_code),
    email: sanitizeAddressField(address?.email),
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

const extractItemUnitPrice = (item) => {
  if (!item) return 0;
  if (typeof item.price === 'number') {
    return Number.isFinite(item.price) ? item.price : 0;
  }
  if (item.price && typeof item.price === 'object') {
    const raw = item.price.discountPrice ?? item.price.currentPrice;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  if (item.price !== undefined && item.price !== null) {
    const directNum = Number(item.price);
    if (Number.isFinite(directNum)) return directNum;
  }
  return 0;
};

const getErrorLabels = (error) => {
  if (!error) return [];
  if (Array.isArray(error.errorLabels)) return error.errorLabels;
  if (Array.isArray(error.result?.errorLabels)) return error.result.errorLabels;
  if (error.errorLabels instanceof Set) return Array.from(error.errorLabels);
  if (error.result?.errorLabels instanceof Set) return Array.from(error.result.errorLabels);
  return [];
};

const isRetryableTransactionError = (error) => {
  if (!error) return false;

  if (typeof error.hasErrorLabel === 'function') {
    if (error.hasErrorLabel('TransientTransactionError')) return true;
  }

  const labels = getErrorLabels(error);
  if (labels.includes('TransientTransactionError')) return true;

  if (error.code === 112 || error.codeName === 'WriteConflict') return true;
  if (error.cause && (error.cause.code === 112 || error.cause.codeName === 'WriteConflict'))
    return true;

  const textToCheck = [
    error.message,
    error.codeName,
    error.name,
    error.cause?.message,
    error.cause?.codeName,
    error.stack,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    /write\s*conflict/i.test(textToCheck) ||
    /transienttransactionerror/i.test(textToCheck) ||
    textToCheck.includes('yielding is disabled') ||
    textToCheck.includes('Please retry your operation')
  );
};

const getRetryDelayMs = (attempt) => {
  const base = TX_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 50);
  return base + jitter;
};

const isUnknownCommitResult = (error) => {
  if (!error) return false;
  if (
    typeof error.hasErrorLabel === 'function' &&
    error.hasErrorLabel('UnknownTransactionCommitResult')
  ) {
    return true;
  }
  return getErrorLabels(error).includes('UnknownTransactionCommitResult');
};

const TX_OPTIONS = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' },
  maxCommitTimeMS: 10000,
};

/**
 * Execute txnWork(session) inside a MongoDB transaction with automatic retries on:
 * WriteConflict, TransientTransactionError, or UnknownTransactionCommitResult.
 * Returns { committed: true, result } or { committed: false, error }.
 */
const runOrderTransaction = async (txnWork, retryMeta = {}) => {
  for (let attempt = 0; attempt <= MAX_TX_RETRIES; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction(TX_OPTIONS);
      const result = await txnWork(session);
      await session.commitTransaction();
      return { committed: true, result };
    } catch (error) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch {
        // no-op
      }

      if (
        (isRetryableTransactionError(error) || isUnknownCommitResult(error)) &&
        attempt < MAX_TX_RETRIES
      ) {
        const delay = getRetryDelayMs(attempt);
        logger.warn(
          `Retrying transaction due to ${error.codeName || error.message} (attempt ${attempt + 1}/${MAX_TX_RETRIES}) after ${delay}ms`,
          { ...retryMeta, attempt: attempt + 1, error: error.message },
        );
        await sleep(delay);
        continue;
      }

      return { committed: false, error };
    } finally {
      try {
        await session.endSession();
      } catch {
        // no-op
      }
    }
  }

  return {
    committed: false,
    error: new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create order after retries'),
  };
};

/**
 * Handle post-transaction order creation outcome:
 * - Commit succeeded -> publish created events and return result.
 * - UnknownTransactionCommitResult -> query existing group orders; if present,
 *   publish events and return result to prevent lost notifications.
 * - Other errors -> rethrow.
 */
const finalizeOrderCreation = async (
  { committed, result, orderGroupId },
  successMessage,
  publishCreatedEvents,
) => {
  if (committed) {
    publishCreatedEvents(result.orders);
    return result;
  }

  if (!isUnknownCommitResult(result.error)) {
    throw result.error;
  }

  const existingOrders = await Order.findByOrderGroupIdLean(orderGroupId);
  if (existingOrders.length > 0) {
    publishCreatedEvents(existingOrders);
    return { message: successMessage, orderGroupId, orders: existingOrders };
  }

  throw result.error;
};

/** Load user and snapshot shipping address (shared by createOrder and buyNow). */
const loadUserAndShippingAddress = async (userId, addressId, note, session) => {
  const user = await User.findByIdWithAddresses(userId).session(session);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const selectedAddress = user.addresses?.id(addressId);
  if (!selectedAddress) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Shipping address not found for current user');
  }

  return buildShippingAddressSnapshot(selectedAddress, note);
};

/**
 * Apply shop voucher if provided and atomically increment usage count.
 * @returns {Promise<{ discountShop: number, appliedVouchers: Array, shopVoucherResult: Object|null }>}
 */
const applyShopVoucher = async ({ shopVouchers, shopIdStr, userId, subtotal, session }) => {
  const result = { discountShop: 0, appliedVouchers: [], shopVoucherResult: null };
  const entry = (shopVouchers || []).find((v) => v?.shopId?.toString() === shopIdStr);
  if (!entry) return result;

  const voucherResult = await voucherService.applyVoucher(entry.code, userId, subtotal, shopIdStr);
  result.discountShop = requireFiniteNumber(
    voucherResult.discountAmount,
    `Invalid shop voucher discount for shop ${shopIdStr}`,
  );
  result.appliedVouchers.push({
    voucherId: voucherResult.voucherId,
    code: voucherResult.code,
    scope: 'shop',
    discountAmount: result.discountShop,
  });
  result.shopVoucherResult = voucherResult;

  const updateRes = await Voucher.incrementUsageWithLimit(voucherResult.voucherId, { session });
  if (!updateRes?.matchedCount) {
    throw new ApiError(StatusCodes.CONFLICT, 'Shop voucher usage limit reached');
  }
  return result;
};

/** Record shop voucher usage associated with orderId for cancellation rollback. */
const recordShopVoucherUsage = (shopVoucherResult, userId, orderId, session) => {
  if (!shopVoucherResult) return null;
  return VoucherUsage.create([{ voucherId: shopVoucherResult.voucherId, userId, orderId }], {
    session,
  });
};

/** Build status counts object from aggregation rows. */
const buildStatusStats = (rows) => {
  const statusStats = {};
  rows.forEach((item) => {
    statusStats[item._id] = {
      count: item.count,
      totalAmount: item.totalAmount,
    };
  });
  return statusStats;
};

/** Format daily aggregation rows to { date, orders, revenue }. */
const formatDailyOrders = (dailyOrders) =>
  dailyOrders.map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
    orders: item.orders,
    revenue: item.revenue,
  }));

/** Calculate 30-day cutoff date for rolling daily statistics. */
const thirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

/**
 * Service handling order operations
 * Manages order creation, retrieval, status updates, and statistics
 */
class OrderService {
  async initRabbitMQ(clientName = 'publisher') {
    return connectRabbitMQ('order', { confirm: true, clientName: clientName });
  }

  /**
   * Publish message to the topic exchange.
   * - strict=false (fire-and-forget events): errors are logged without throwing.
   * - strict=true (order commands): confirmation errors throw to prevent silent order loss.
   */
  async publishOrder(payload, routingKey, { strict = false } = {}) {
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
        timeout: 5000,
      });
    } catch (error) {
      logger.error('Failed to confirm order message', {
        error: error.message,
        routingKey,
        userId: payload.userId,
      });
      if (strict) {
        throw error;
      }
    }
  }

  /**
   * Route failed message to retry queue for the corresponding namespace.
   * @param {Buffer} content
   * @param {number} retryCount
   * @param {'order'|'orderCommand'} [queueNamespace='order']
   */
  async publishOrderRetry(content, retryCount, queueNamespace = 'order') {
    const { retryQueue } = config_rabbitMQ.queues[queueNamespace];
    return publishToRetryQueue({
      serviceName: 'order',
      clientName: `retry-publisher-${queueNamespace}`,
      queueName: retryQueue,
      content,
      retryCount,
    });
  }

  /**
   * Route message exceeding retry limits to the failed queue.
   * @param {Buffer} content
   * @param {number} retryCount
   * @param {'order'|'orderCommand'} [queueNamespace='order']
   */
  async publishOrderFailed(content, retryCount, queueNamespace = 'order') {
    const { failedQueue } = config_rabbitMQ.queues[queueNamespace];
    return publishToFailedQueue({
      serviceName: 'order',
      clientName: `failed-publisher-${queueNamespace}`,
      queueName: failedQueue,
      content,
      retryCount,
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

  async publishOrderEvent(eventName, payload, options = {}) {
    return this.publishOrder(
      {
        eventName,
        ...payload,
      },
      eventName,
      options,
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
    const payload = this.buildOrderEventPayload(order, {
      previousStatus,
      actor,
      ...extra,
    });

    try {
      await outboxService.enqueueEvent({
        eventType: ORDER_EVENT_TYPES.STATUS_CHANGED,
        routingKey: ORDER_EVENT_TYPES.STATUS_CHANGED,
        payload,
      });
      outboxService.dispatchPendingEvents().catch((dispatchErr) => {
        logger.warn('Background outbox dispatch error for status change (non-fatal)', {
          error: dispatchErr.message,
        });
      });
    } catch (err) {
      logger.warn('Failed to enqueue status change in outbox, falling back to direct publish', {
        error: err.message,
      });
      return this.publishOrderEvent(ORDER_EVENT_TYPES.STATUS_CHANGED, payload);
    }
  }
  /**
   * Unified core checkout execution inside a MongoDB transaction.
   * Handles multi-shop splitting, inventory deduction, flash-sale pricing,
   * shop & platform voucher calculations, and atomic cart cleanup.
   * @param {string|Types.ObjectId} userId
   * @param {Object} options
   * @returns {Promise<Object>} { message, orderGroupId, orders }
   */
  async _executeCheckout(
    userId,
    {
      addressId,
      paymentMethod = 'cod',
      shopVouchers = [],
      platformVoucher,
      note,
      cartItemIds,
      snapshottedItems,
      buyNowItem,
    } = {},
  ) {
    const orderGroupId = new Types.ObjectId();

    const { committed, result } = await runOrderTransaction(
      async (session) => {
        const [shippingAddress, cart] = await Promise.all([
          loadUserAndShippingAddress(userId, addressId, note, session),
          Array.isArray(cartItemIds) && cartItemIds.length > 0
            ? Cart.findByUserIdForCheckout(userId, session)
            : Promise.resolve(null),
        ]);

        let itemsToCheckout = [];

        if (buyNowItem) {
          const qty = requireFiniteNumber(buyNowItem.quantity ?? 1, 'Invalid quantity');
          if (!Number.isInteger(qty) || qty < 1) {
            throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Invalid quantity');
          }
          itemsToCheckout = [
            {
              productId: buyNowItem.productId,
              variantId: buyNowItem.variantId || null,
              modelId: buyNowItem.variantId || null,
              quantity: qty,
            },
          ];
        } else if (Array.isArray(snapshottedItems) && snapshottedItems.length > 0) {
          itemsToCheckout = snapshottedItems;
        } else if (Array.isArray(cartItemIds) && cartItemIds.length > 0) {
          if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Cart is empty');
          }

          const idSet = new Set(cartItemIds.map((id) => id.toString()));
          itemsToCheckout = cart.items.filter((item) => idSet.has(item._id.toString()));

          if (itemsToCheckout.length === 0) {
            throw new ApiError(StatusCodes.BAD_REQUEST, 'No items selected');
          }
        } else {
          throw new ApiError(StatusCodes.BAD_REQUEST, 'No checkout items specified');
        }

        // 1. Fetch all products to validate existence and resolve shop IDs
        const productIds = itemsToCheckout.map((item) => item.productId?._id || item.productId);
        const products = await Product.findByIds(productIds).session(session);
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));

        // 2. Group items by Shop
        const shopItemsMap = new Map(); // shopIdStr -> Array<{ item, product }>

        for (const item of itemsToCheckout) {
          const prodIdStr = (item.productId?._id || item.productId).toString();
          const product = productMap.get(prodIdStr);
          if (!product || product.status !== 'published') {
            throw new ApiError(
              StatusCodes.CONFLICT,
              `${product?.name || item.productId?.name || 'Product'} unavailable`,
            );
          }

          const shopId = item.shopId || product.shop;
          if (!shopId) {
            throw new ApiError(
              StatusCodes.UNPROCESSABLE_ENTITY,
              `Product ${product.name || 'item'} has no shop`,
            );
          }

          const shopIdStr = shopId.toString();
          if (!shopItemsMap.has(shopIdStr)) {
            shopItemsMap.set(shopIdStr, []);
          }
          shopItemsMap.get(shopIdStr).push({ item, product });
        }

        // 3. Process orders per shop
        const createdOrders = [];
        const tempOrders = [];
        let totalPlatformOrderValue = 0;

        for (const [shopId, shopEntries] of shopItemsMap.entries()) {
          const orderProducts = [];
          let subtotal = 0;
          const inventoryItems = [];

          for (const { item, product } of shopEntries) {
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

            const variantId = item.variantId || item.modelId || null;
            const { price, isFlashSale, skuCode, variant } = resolveEffectiveItemPrice({
              product,
              variantId,
            });

            inventoryItems.push({
              productId: product._id,
              modelId: variantId,
              quantity,
              ...(isFlashSale ? { isFlashSale: true } : {}),
            });

            const lineTotal = price * quantity;
            subtotal += lineTotal;

            orderProducts.push({
              productId: product._id,
              sku: skuCode,
              variantId,
              name: product.name,
              image: (variant && variant.images?.[0]) || product.images?.[0] || '',
              quantity,
              price,
              totalPrice: lineTotal,
              isFlashSale,
            });
          }

          // Deduct stock atomically via inventoryService
          await inventoryService.deductStock(inventoryItems, session);

          // Apply Shop Voucher
          const { discountShop, appliedVouchers, shopVoucherResult } = await applyShopVoucher({
            shopVouchers,
            shopIdStr: shopId,
            userId,
            subtotal,
            session,
          });

          const totalAmount = Math.max(0, subtotal - discountShop);
          totalPlatformOrderValue += totalAmount;

          const newOrder = Order.build({
            orderGroupId,
            userId,
            shopId,
            products: orderProducts,
            shippingAddress,
            paymentMethod,
            subtotal,
            shippingFee: 0,
            discountShop,
            discountPlatform: 0,
            appliedVouchers,
            totalAmount,
            status: 'pending',
          });

          await recordShopVoucherUsage(shopVoucherResult, userId, newOrder._id, session);
          tempOrders.push(newOrder);
        }

        // 4. Apply Platform Voucher proportionally across all orders
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

          distributePlatformDiscount(tempOrders, totalPlatformDiscount);

          tempOrders.forEach((order) => {
            order.appliedVouchers.push({
              voucherId: voucherResult.voucherId,
              code: voucherResult.code,
              scope: 'platform',
              discountAmount: order.discountPlatform,
            });
          });

          const updateRes = await Voucher.incrementUsageWithLimit(voucherResult.voucherId, {
            session,
          });
          if (!updateRes?.matchedCount) {
            throw new ApiError(StatusCodes.CONFLICT, 'Platform voucher usage limit reached');
          }
          await VoucherUsage.create(
            [{ voucherId: voucherResult.voucherId, userId, orderGroupId }],
            { session },
          );
        }

        // 5. Persist orders in a single batch
        const insertedOrders = await Order.insertMany(tempOrders, { session });
        createdOrders.push(...insertedOrders);

        // 6. Atomic Cart Cleanup (Only executed when checkout from cart within the transaction)
        if (cart && Array.isArray(cart.items) && Array.isArray(cartItemIds)) {
          const idSet = new Set(cartItemIds.map((id) => id.toString()));
          cart.items = cart.items.filter((item) => !idSet.has(item._id.toString()));
          cart.totalAmount = Math.max(0, Number(this.calculateTotal(cart.items)) || 0);
          cart.cartCount = cart.items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
          await cart.save({ session });
        }

        // 7. Transactional Outbox: Enqueue order created events atomically within transaction session
        const outboxEvents = createdOrders.map((order) => ({
          eventType: ORDER_EVENT_TYPES.CREATED,
          routingKey: ORDER_EVENT_TYPES.CREATED,
          payload: this.buildOrderEventPayload(order),
        }));
        await outboxService.enqueueEvents(outboxEvents, { session });

        return {
          message:
            createdOrders.length > 1 ? 'Orders created successfully' : 'Order created successfully',
          orderGroupId,
          orders: createdOrders,
        };
      },
      { userId },
    );

    return finalizeOrderCreation(
      { committed, result, orderGroupId },
      result?.message || 'Orders created successfully',
      async (orders) => {
        try {
          await this.publishOrderCreatedEvents(orders);
        } catch (pubErr) {
          logger.warn('Failed to publish order created events directly (outbox will retry)', {
            error: pubErr.message,
          });
        }
        outboxService.dispatchPendingEvents().catch((dispatchErr) => {
          logger.warn('Background outbox dispatch error (non-fatal)', {
            error: dispatchErr.message,
          });
        });
      },
    );
  }

  /**
   * Create orders from cart items with transaction support
   * Splits items by shop and creates separate orders per shop
   * @param {string} userId - User ID placing the order
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Created orders with group ID
   */
  async createOrder(userId, orderData) {
    return this._executeCheckout(userId, {
      ...orderData,
      cartItemIds: orderData.cartItemIds,
    });
  }

  /**
   * Calculate total amount from cart items
   * @param {Array} items - Cart items with price and quantity
   * @returns {number} Total amount
   */
  calculateTotal(items) {
    if (!Array.isArray(items)) return 0;
    const total = items.reduce((sum, item) => {
      const unitPrice = extractItemUnitPrice(item);
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      return sum + unitPrice * quantity;
    }, 0);
    return Number.isFinite(total) ? Math.max(0, total) : 0;
  }

  /**
   * Buy now - direct checkout for a single product without cart
   * Especially optimized for flash sales and instant purchases
   * @param {string} userId - User ID placing the order
   * @param {Object} buyNowData - Direct checkout details
   * @returns {Promise<Object>} Created order with group ID
   */
  async buyNow(userId, buyNowData) {
    const { productId, variantId, quantity = 1, ...rest } = buyNowData;
    return this._executeCheckout(userId, {
      ...rest,
      buyNowItem: { productId, variantId, quantity },
    });
  }

  /**
   * @deprecated Asynchronous order ingestion via queue is deprecated in favor of reliable transactional checkout.
   */
  async enqueueOrderCreation(userId, orderData, { isBuyNow = false } = {}) {
    logger.warn('enqueueOrderCreation is deprecated. Executing checkout synchronously.');
    if (isBuyNow) {
      return this.buyNow(userId, orderData);
    }
    return this.createOrder(userId, orderData);
  }

  /**
   * Get order tracking status from Redis
   * @deprecated Use WebSocket real-time events (`order_created`, `order_failed`) instead of polling Redis keys
   * @param {string} trackingId - UUID tracking ID
   * @param {string} userId - User ID requesting status
   * @returns {Promise<Object>} Order tracking status details
   */
  async getOrderTrackingStatus(trackingId, userId) {
    const trackingKey = `order:tracking:${trackingId}`;
    const statusData = await redisService.get(trackingKey);

    if (!statusData) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Tracking information not found or expired');
    }

    if (statusData.userId && statusData.userId !== userId.toString()) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to view this order tracking');
    }

    return statusData;
  }

  /**
   * Get all orders for a user with pagination and filters
   * @param {string} userId - User ID
   * @param {Object} [filters] - Query filters
   * @returns {Promise<Object>} User's orders with pagination
   */
  async getUserOrders(userId, filters = {}) {
    const { page = 1, limit = 10, status, paymentStatus, paymentMethod } = filters;
    const filterArgs = { userId, status, paymentStatus, paymentMethod };
    const total = await Order.countAllWithFilters(filterArgs);
    const paginationParams = getPaginationParams(page, limit, total);
    const orders = await Order.findAllWithFilters(filterArgs, paginationParams);
    return buildPaginationResponse(orders, paginationParams);
  }

  /**
   * Get all orders for a shop (Seller dashboard)
   * @param {string} shopId - Shop ID
   * @param {Object} [filters] - Optional filters (unused, for future expansion)
  /**
   * Get all orders for a shop (delegates to paginated getOrdersByShop)
   * @deprecated Use getOrdersByShop directly
   * @param {string} shopId - Shop ID
   * @param {Object} [filters={}] - Query filters
   * @returns {Promise<Object>} Paginated orders
   */
  async getShopOrders(shopId, filters = {}) {
    return this.getOrdersByShop(shopId, filters);
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
   * Restore inventory stock when an order is cancelled
   * @param {Object} order - Order object
   * @param {Object} [session=null] - Mongoose session for atomic execution
   */
  async restoreOrderStock(order, session = null) {
    const inventoryItems = order.products.map((item) => ({
      productId: item.productId,
      modelId: item.variantId,
      quantity: item.quantity,
      ...(item.isFlashSale ? { isFlashSale: true } : {}),
    }));

    await inventoryService.restoreStock(inventoryItems, session);
  }

  /**
   * Cancel an order atomically in a transaction:
   * Restores stock and marks status as cancelled in a single commit.
   * Concurrent cancellation requests on the same order are protected via
   * write conflict detection.
   *
   * Voucher rollback and event publishing run post-commit (rollback is idempotent,
   * while RabbitMQ events cannot be rolled back if open in transaction).
   *
   * @param {(session: Object) => Promise<Object>} loadOrder - Loads order with actor authorization checks
   * @param {string} actor - ORDER_ACTORS.USER | SELLER | ADMIN
   * @returns {Promise<Object>} Cancelled order
   */
  async _cancelOrderAtomically(loadOrder, actor) {
    const txn = await runOrderTransaction(async (session) => {
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

      return { order, previousStatus };
    });

    if (!txn.committed) {
      throw txn.result.error;
    }

    const { order, previousStatus } = txn.result;

    // Online-paid orders requiring manual customer support refund
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
   * Rollback voucher usages applied to an order upon cancellation:
   * - Shop vouchers: 1:1 binding with order -> rolled back immediately.
   * - Platform vouchers: shared across order group -> rolled back only when
   *   ALL orders within the group have been cancelled.
   * - Orders created prior to voucher tracking -> safe no-op.
   * @param {Object} order - Order document being cancelled
   */
  async rollbackOrderVouchers(order) {
    const applied = order.appliedVouchers || [];
    if (applied.length === 0) return;

    for (const appliedVoucher of applied) {
      if (appliedVoucher.scope === 'platform') {
        // Missing orderGroupId -> cannot locate usage record safely, skip to prevent erroneous rollback
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

    // Run all shop statistics aggregations concurrently
    const [ordersByStatus, revenueStats, dailyOrders, topProducts, summaryCounts] =
      await Promise.all([
        Order.aggregateSellerOrdersByStatus(shopObjectId),
        Order.aggregateSellerRevenueStats(shopObjectId),
        Order.aggregateSellerDailyOrders(shopObjectId, thirtyDaysAgo()),
        Order.aggregateSellerTopProducts(shopObjectId, 10),
        Order.aggregateSellerSummaryCounts(shopObjectId),
      ]);

    const statusStats = buildStatusStats(ordersByStatus);

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
      dailyOrders: formatDailyOrders(dailyOrders),
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
  /**
   * Get order by ID with authorization check (Admin, Buyer, or Shop Owner)
   * @param {string} orderId - Order ID
   * @param {string} userId - Requesting user's ID
   * @param {boolean} isAdmin - Whether user is admin
   * @param {string} [shopId] - Seller's shop ID if available
   * @returns {Promise<Object>} Order object
   * @throws {Error} If order not found or unauthorized
   */
  async getOrderById(orderId, userId, isAdmin = false, shopId = null) {
    const order = await Order.findByIdWithShopAndProducts(orderId);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
    }

    const userIdStr = userId ? userId.toString() : '';
    const isBuyer =
      Boolean(userIdStr) &&
      (order.userId?._id?.toString() || order.userId?.toString()) === userIdStr;

    const orderShopId = (order.shopId?._id || order.shopId)?.toString();
    let isSeller = Boolean(shopId && orderShopId && shopId.toString() === orderShopId);

    if (!isAdmin && !isBuyer && !isSeller && orderShopId && userIdStr) {
      const shop = await Shop.findByIdLean(orderShopId);
      if (shop && shop.owner?.toString() === userIdStr) {
        isSeller = true;
      }
    }

    if (!isAdmin && !isBuyer && !isSeller) {
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

    // Cancel status requires atomic stock restoration and voucher rollback within a transaction
    if (status === 'cancelled') {
      return this._cancelOrderAtomically(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) {
          throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
        }

        // Authorization check matching non-cancel path
        if (!isAdmin) {
          const currentShopIdStr = (order.shopId?._id || order.shopId)?.toString();
          if (shopId && currentShopIdStr !== shopId.toString()) {
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
      const currentShopIdStr = (order.shopId?._id || order.shopId)?.toString();
      if (shopId && currentShopIdStr !== shopId.toString()) {
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
    const updateFields = { status };

    if (status === 'delivered') {
      updateFields.deliveredAt = new Date();
      if (order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
        updateFields.paymentStatus = 'paid';
      }
    }

    // Atomic CAS to prevent concurrent lost updates
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: previousStatus },
      { $set: updateFields },
      { new: true },
    );

    if (!updatedOrder) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Order status was modified by another concurrent request',
      );
    }

    await this.publishOrderStatusChangedEvent(updatedOrder, previousStatus, actor);
    return updatedOrder;
  }

  /**
   * Cancel an order and restore stock (user or admin path)
   * Atomic stock restoration and status mutation within a transaction to prevent double stock return.
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID (for ownership verification)
   * @param {boolean} [isAdmin=false] - Admin can cancel any order
   * @returns {Promise<Object>} Cancelled order
   * @throws {Error} If order not found, access denied, or cannot be cancelled
   */
  async cancelOrder(orderId, userId, isAdmin = false) {
    const actor = isAdmin ? ORDER_ACTORS.ADMIN : ORDER_ACTORS.USER;
    return this._cancelOrderAtomically(async (session) => {
      const order = isAdmin
        ? await Order.findById(orderId).session(session)
        : await Order.findByIdAndUser(orderId, userId).session(session);

      if (!order) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found or access denied');
      }

      // Online-paid orders: user self-cancellation blocked to prevent inventory/fund desync without automated refunds. Admin cancellation remains allowed.
      if (!isAdmin && order.paymentStatus === 'paid') {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'Đơn hàng đã được thanh toán online. Vui lòng liên hệ hỗ trợ để hủy đơn và hoàn tiền.',
        );
      }

      return order;
    }, actor);
  }

  /**
   * Confirm delivery by the buyer (atomic CAS update).
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
    const updateFields = {
      status: 'delivered',
      deliveredAt: new Date(),
    };
    if (order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
      updateFields.paymentStatus = 'paid';
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, userId, status: 'shipped' },
      { $set: updateFields },
      { new: true },
    );

    if (!updatedOrder) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Order status was modified by another concurrent request',
      );
    }

    await this.publishOrderStatusChangedEvent(updatedOrder, previousStatus, ORDER_ACTORS.USER);
    return updatedOrder;
  }

  /**
   * Auto-cancel online orders that remained unpaid beyond timeout (Denial-of-Inventory protection).
   * Restores stock and returns count of cancelled orders.
   * @param {number} [timeoutMinutes=15]
   * @returns {Promise<number>} Number of expired orders cancelled
   */
  async cancelExpiredUnpaidOrders(timeoutMinutes = 15) {
    const cutoffDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const expiredOrders = await Order.findManyByFilter({
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: { $in: ['vnpay', 'momo'] },
      createdAt: { $lt: cutoffDate },
    });

    let cancelledCount = 0;
    for (const order of expiredOrders) {
      try {
        await this._cancelOrderAtomically(async (session) => {
          const freshOrder = await Order.findById(order._id).session(session);
          if (
            freshOrder &&
            freshOrder.status === 'pending' &&
            freshOrder.paymentStatus === 'unpaid'
          ) {
            freshOrder.cancelReason = 'Online payment expired';
            return freshOrder;
          }
          throw new ApiError(
            StatusCodes.CONFLICT,
            'Order no longer eligible for auto-cancellation',
          );
        }, ORDER_ACTORS.ADMIN);
        cancelledCount++;
      } catch (err) {
        logger.warn('Failed to auto-cancel expired order', {
          orderId: order._id?.toString(),
          error: err.message,
        });
      }
    }
    return cancelledCount;
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

    // Run all statistics aggregations concurrently
    const [
      ordersByStatus,
      revenueStats,
      ordersByPaymentMethod,
      dailyOrders,
      topProducts,
      ordersByShop,
      adminSummaryCounts,
    ] = await Promise.all([
      Order.aggregateAdminOrdersByStatusInRange(startDate, endDate),
      Order.aggregateAdminRevenueStatsInRange(startDate, endDate),
      Order.aggregateAdminOrdersByPaymentMethodInRange(startDate, endDate),
      Order.aggregateAdminDailyOrders(thirtyDaysAgo()),
      Order.aggregateAdminTopProductsInRange(startDate, endDate, 10),
      Order.aggregateAdminOrdersByShopInRange(startDate, endDate, 10),
      Order.aggregateAdminSummaryCountsInRange(startDate, endDate),
    ]);

    // Convert to object for easier access
    const statusStats = buildStatusStats(ordersByStatus);

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
      dailyOrders: formatDailyOrders(dailyOrders),
      topProducts,
      ordersByShop,
    };
  }
}

const orderServiceInstance = new OrderService();
orderServiceInstance.isRetryableTransactionError = isRetryableTransactionError;
orderServiceInstance._isRetryableTransactionError = isRetryableTransactionError;
orderServiceInstance._extractItemUnitPrice = extractItemUnitPrice;
orderServiceInstance._isUnknownCommitResult = isUnknownCommitResult;
orderServiceInstance.distributeDiscount = distributePlatformDiscount;
orderServiceInstance._resolveEffectiveItemPrice = resolveEffectiveItemPrice;

module.exports = orderServiceInstance;
