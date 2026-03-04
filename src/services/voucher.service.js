const Voucher = require('../repositories/voucher.repository');
const VoucherUsage = require('../repositories/voucher-usage.repository');
const Shop = require('../repositories/shop.repository');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');

/**
 * Service handling voucher/coupon operations
 * Manages voucher creation, retrieval, validation, and application
 */
class VoucherService {
  /**
   * Create a new voucher
   * @param {string} userId - Creator's user ID
   * @param {string[]} roles - User's roles
   * @param {Object} voucherData - Voucher details
   * @returns {Promise<Object>} Created voucher
   */
  async createVoucher(userId, roles, voucherData) {
    const role = roles.includes('admin') ? 'admin' : 'seller';

    let shopId = null;
    let scope = 'platform';

    if (role === 'seller') {
      const shop = await Shop.findByOwnerId(userId);
      if (!shop) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Shop not found');
      }

      shopId = shop._id;
      scope = 'shop';
    }

    // Check if code already exists
    const existingVoucher = await Voucher.findByCode(voucherData.code);
    if (existingVoucher) {
      throw new ApiError(StatusCodes.CONFLICT, 'Voucher code already exists');
    }

    const newVoucher = await Voucher.create({
      ...voucherData,
      shopId,
      scope,
    });

    return newVoucher;
  }

  /**
   * Get voucher by ID
   * @param {string} voucherId - Voucher ID
   * @returns {Promise<Object>} Voucher object
   * @throws {Error} If voucher not found
   */
  async getVoucherById(voucherId) {
    const voucher = await Voucher.findByIdWithShop(voucherId);

    if (!voucher) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
    }

    return voucher;
  }

  /**
   * Get all vouchers with filtering and pagination (Admin)
   * @param {Object} filters - Filter options
   * @param {number} [filters.page=1] - Page number
   * @param {number} [filters.limit=10] - Items per page
   * @param {string} [filters.scope] - Filter by scope (platform/shop)
   * @param {boolean} [filters.isActive] - Filter by active status
   * @param {string} [filters.search] - Search by code or name
   * @returns {Promise<Object>} List of vouchers with pagination
   */
  async getAllVouchers(filters = {}) {
    const { page = 1, limit = 10, scope, isActive, search, shopId } = filters;
    const filterArgs = { scope, isActive, search, shopId };
    const total = await Voucher.countWithFilters(filterArgs);
    const paginationParams = getPaginationParams(page, limit, total);

    const vouchers = await Voucher.findWithFilters(filterArgs, paginationParams);

    return buildPaginationResponse(vouchers, paginationParams);
  }

  /**
   * Update voucher by ID
   * @param {string} voucherId - Voucher ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User performing the update
   * @param {string[]} roles - User's roles
   * @returns {Promise<Object>} Updated voucher
   * @throws {Error} If voucher not found or unauthorized
   */
  async updateVoucher(voucherId, updateData, userId, roles) {
    const voucher = await Voucher.findById(voucherId);

    if (!voucher) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
    }

    // Check authorization
    const isAdmin = roles.includes('admin');
    if (!isAdmin && voucher.scope === 'shop') {
      const shop = await Shop.findByOwnerId(userId);
      if (!shop || voucher.shopId.toString() !== shop._id.toString()) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to update this voucher');
      }
    }

    // Check if updating code and it already exists
    if (updateData.code && updateData.code !== voucher.code) {
      const existingVoucher = await Voucher.findByCodeExcludingId(updateData.code, voucherId);
      if (existingVoucher) {
        throw new ApiError(StatusCodes.CONFLICT, 'Voucher code already exists');
      }
    }

    // Update voucher
    Object.assign(voucher, updateData);
    await voucher.save();

    return voucher;
  }

  /**
   * Delete voucher (soft delete by setting isActive to false)
   * @param {string} voucherId - Voucher ID
   * @param {string} userId - User performing the delete
   * @param {string[]} roles - User's roles
   * @returns {Promise<Object>} Deleted voucher
   * @throws {Error} If voucher not found or unauthorized
   */
  async deleteVoucher(voucherId, userId, roles) {
    const voucher = await Voucher.findById(voucherId);

    if (!voucher) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
    }

    // Check authorization
    const isAdmin = roles.includes('admin');
    if (!isAdmin && voucher.scope === 'shop') {
      const shop = await Shop.findByOwnerId(userId);
      if (!shop || voucher.shopId.toString() !== shop._id.toString()) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized to delete this voucher');
      }
    }

    // Soft delete
    voucher.isActive = false;
    await voucher.save();

    return { message: 'Voucher deleted successfully', voucher };
  }

  /**
   * Permanently delete voucher (Admin only)
   * @param {string} voucherId - Voucher ID
   * @returns {Promise<Object>} Deletion result
   */
  async permanentDeleteVoucher(voucherId) {
    const voucher = await Voucher.deleteById(voucherId);

    if (!voucher) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found');
    }

    return { message: 'Voucher permanently deleted' };
  }

  /**
   * Get vouchers for a specific shop
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>} List of active vouchers
   */
  async getShopVouchers(shopId) {
    const vouchers = await Voucher.findActiveByShop(shopId, new Date());
    return vouchers;
  }

  /**
   * Get platform-wide vouchers
   * @returns {Promise<Array>} List of active platform vouchers
   */
  async getPlatformVouchers() {
    const vouchers = await Voucher.findActivePlatform(new Date());
    return vouchers;
  }

  /**
   * Get available vouchers for user (both platform and shop)
   * @param {string} userId - User ID
   * @param {string} [shopId] - Optional shop ID to include shop vouchers
   * @returns {Promise<Object>} Available vouchers grouped by type
   */
  async getAvailableVouchers(userId, shopId = null) {
    const now = new Date();

    // Get platform vouchers
    const platformVouchers = await Voucher.findAvailablePlatform(now);

    // Get shop vouchers if shopId provided
    let shopVouchers = [];
    if (shopId) {
      shopVouchers = await Voucher.findAvailableShop(shopId, now);
    }

    // Filter out vouchers user has exceeded usage limit
    const filterByUserUsage = async (vouchers) => {
      if (vouchers.length === 0) return vouchers;
      const voucherIds = vouchers.map((v) => v._id);
      const mongoose = require('mongoose');
      const usages = await VoucherUsage.aggregateUsageByVoucherIdsAndUser(
        voucherIds,
        new mongoose.Types.ObjectId(userId),
      );
      const usageMap = new Map(usages.map((u) => [u._id.toString(), u.count]));
      return vouchers.filter((voucher) => {
        if (voucher.usageLimitPerUser === 0) return true;
        const usedCount = usageMap.get(voucher._id.toString()) || 0;
        return usedCount < voucher.usageLimitPerUser;
      });
    };

    return {
      platform: await filterByUserUsage(platformVouchers),
      shop: await filterByUserUsage(shopVouchers),
    };
  }

  /**
   * Validate and apply voucher to order
   * @param {string} code - Voucher code
   * @param {string} userId - User ID
   * @param {number} orderValue - Order total value
   * @param {string} [shopId] - Shop ID for shop vouchers
   * @returns {Promise<Object>} Voucher application result
   * @throws {Error} If voucher is invalid or cannot be applied
   */
  async applyVoucher(code, userId, orderValue, shopId = null) {
    const voucher = await Voucher.findActiveByCode(code);
    if (!voucher) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Voucher not found or inactive');
    }

    // 1. Check Date
    const now = new Date();
    if (now < voucher.startDate || now > voucher.endDate) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Voucher is expired or not yet valid');
    }

    // 2. Check Scope
    if (voucher.scope === 'shop') {
      if (!shopId) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'This is a shop voucher');
      }
      if (voucher.shopId.toString() !== shopId.toString()) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Voucher does not apply to this shop');
      }
    }

    // 3. Check Min Order Value
    if (orderValue < voucher.minOrderValue) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Order value must be at least ${voucher.minOrderValue}`,
      );
    }

    // 4. Check Usage Limit (Global)
    if (voucher.usageLimit > 0 && voucher.usageCount >= voucher.usageLimit) {
      throw new ApiError(StatusCodes.CONFLICT, 'Voucher usage limit reached');
    }

    // 5. Check Usage Limit (Per User) via VoucherUsage collection
    const usedCount = await VoucherUsage.countByVoucherAndUser(voucher._id, userId);

    if (voucher.usageLimitPerUser > 0 && usedCount >= voucher.usageLimitPerUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'You have reached the usage limit for this voucher');
    }

    // 6. Calculate Discount
    let discountAmount = 0;
    if (voucher.type === 'fixed_amount') {
      discountAmount = voucher.value;
    } else if (voucher.type === 'percentage') {
      discountAmount = (orderValue * voucher.value) / 100;
      if (voucher.maxValue > 0) {
        discountAmount = Math.min(discountAmount, voucher.maxValue);
      }
    }

    return {
      voucherId: voucher._id,
      code: voucher.code,
      discountAmount,
      type: voucher.type,
      scope: voucher.scope,
    };
  }

  /**
   * Get voucher statistics (Admin)
   * @returns {Promise<Object>} Voucher statistics
   */
  async getVoucherStatistics() {
    const now = new Date();

    const totalVouchers = await Voucher.countAll();
    const activeVouchers = await Voucher.countActive();
    const expiredVouchers = await Voucher.countExpired(now);
    const platformVouchers = await Voucher.countPlatformVouchers();
    const shopVouchers = await Voucher.countShopVouchers();

    const mostUsedVouchers = await Voucher.findMostUsed(5);

    const discountStats = await Voucher.aggregateTotalUsage();

    return {
      totalVouchers,
      activeVouchers,
      expiredVouchers,
      platformVouchers,
      shopVouchers,
      mostUsedVouchers,
      totalUsage: discountStats[0]?.totalUsage || 0,
    };
  }
}

module.exports = new VoucherService();
