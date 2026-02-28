const Product = require("../repositories/product.repository");
const redisService = require("./redis.service");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

const {
  getPaginationParams,
  buildPaginationResponse,
} = require("../utils/pagination");

/**
 * Service handling flash sale operations
 * Manages time-limited promotional sales (like Taobao flash deals)
 */
class FlashSaleService {
  /**
   * Get current active flash sale products
   * @param {Object} options - Query options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @returns {Promise<Object>} Flash sale products with timing info
   */
  async getActiveFlashSale({ page = 1, limit = 20 } = {}) {
    const cacheKey = `flash-sale:active:${page}:${limit}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return cached;

    const now = new Date();

    const total = await Product.countActiveFlashSale(now);
    const paginationParams = getPaginationParams(page, limit, total);

    const products = await Product.findActiveFlashSaleProducts(
      now,
      paginationParams,
    );

    // Calculate remaining time and sold percentage
    const enrichedProducts = products.map((p) => ({
      ...p,
      flashSaleInfo: {
        originalPrice: p.price?.currentPrice,
        salePrice: p.flashSale?.salePrice || p.price?.discountPrice,
        discount: p.flashSale?.discountPercent || 0,
        soldCount: p.flashSale?.soldCount || 0,
        totalStock: p.flashSale?.stock || p.stock,
        soldPercent: p.flashSale?.stock
          ? Math.round((p.flashSale.soldCount / p.flashSale.stock) * 100)
          : 0,
        endTime: p.flashSale?.endTime,
        remainingSeconds: Math.max(
          0,
          Math.floor((new Date(p.flashSale?.endTime) - now) / 1000),
        ),
      },
    }));

    const result = {
      ...buildPaginationResponse(enrichedProducts, paginationParams),
      saleInfo: {
        currentTime: now,
        nextSaleTime: this.getNextSaleTime(),
      },
    };

    await redisService.set(cacheKey, result, 60); // 1 min cache
    return result;
  }

  /**
   * Get upcoming flash sale schedule
   * @returns {Promise<Array>} Upcoming flash sale time slots
   */
  async getFlashSaleSchedule() {
    const now = new Date();
    const schedule = [];

    // Generate schedule for next 24 hours (sales at 10:00, 12:00, 20:00, 22:00)
    const saleHours = [10, 12, 20, 22];
    const today = new Date(now);
    today.setMinutes(0, 0, 0);

    for (let day = 0; day < 2; day++) {
      for (const hour of saleHours) {
        const saleTime = new Date(today);
        saleTime.setDate(saleTime.getDate() + day);
        saleTime.setHours(hour);

        if (saleTime > now) {
          const endTime = new Date(saleTime);
          endTime.setHours(endTime.getHours() + 2);

          schedule.push({
            startTime: saleTime,
            endTime: endTime,
            status: "upcoming",
            label: `${hour}:00`,
          });
        }
      }
    }

    return schedule.slice(0, 6); // Return next 6 time slots
  }

  /**
   * Get next flash sale time
   * @returns {Date} Next sale start time
   */
  getNextSaleTime() {
    const now = new Date();
    const saleHours = [10, 12, 20, 22];

    for (const hour of saleHours) {
      const saleTime = new Date(now);
      saleTime.setHours(hour, 0, 0, 0);
      if (saleTime > now) return saleTime;
    }

    // Next day first sale
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(saleHours[0], 0, 0, 0);
    return tomorrow;
  }

  /**
   * Get flash sale by time slot
   * @param {string} timeSlot - Time slot identifier (e.g., "10:00")
   * @returns {Promise<Object>} Flash sale products for that slot
   */
  async getFlashSaleBySlot(timeSlot) {
    const [hours] = timeSlot.split(":").map(Number);
    const now = new Date();
    const slotStart = new Date(now);
    slotStart.setHours(hours, 0, 0, 0);

    if (slotStart < now) {
      slotStart.setDate(slotStart.getDate() + 1);
    }

    const slotEnd = new Date(slotStart);
    slotEnd.setHours(slotEnd.getHours() + 2);

    const products = await Product.findFlashSaleProductsBySlot(
      slotStart,
      slotEnd,
      50,
    );

    return {
      timeSlot,
      startTime: slotStart,
      endTime: slotEnd,
      products,
    };
  }

  /**
   * Add product to flash sale (Seller/Admin)
   * @param {string} productId - Product ID
   * @param {Object} flashSaleData - Flash sale configuration
   * @returns {Promise<Object>} Updated product
   */
  async addToFlashSale(productId, flashSaleData) {
    const { salePrice, discountPercent, stock, startTime, endTime } =
      flashSaleData;

    const product = await Product.setFlashSaleByProductId(productId, {
      isActive: true,
      salePrice,
      discountPercent,
      stock,
      soldCount: 0,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    await redisService.delByPattern("flash-sale:*");

    return product;
  }

  /**
   * Remove product from flash sale
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Updated product
   */
  async removeFromFlashSale(productId) {
    const product = await Product.removeFlashSaleByProductId(productId);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    await redisService.delByPattern("flash-sale:*");
    return product;
  }

  /**
   * Get flash sale statistics (Admin)
   * @returns {Promise<Object>} Flash sale statistics
   */
  async getFlashSaleStats() {
    const now = new Date();

    const [activeCount, totalSold, topProducts] = await Promise.all([
      Product.countActiveFlashSale(now),
      Product.aggregateTotalFlashSaleSold(),
      Product.findTopFlashSaleProducts(10),
    ]);

    return {
      activeProducts: activeCount,
      totalSold: totalSold[0]?.total || 0,
      topProducts,
    };
  }
}

module.exports = new FlashSaleService();
