/**
 * Utilities for discount calculations, flash-sale pricing resolutions,
 * and multi-shop proportional voucher distribution.
 *
 * Centralizes pricing and discount logic previously scattered across
 * OrderService, VoucherService, and CartService.
 */

const { StatusCodes } = require('http-status-codes');
const ApiError = require('./ApiError');
const { getProductFlashSale } = require('./flashSale.util');
const { toFiniteNumber } = require('./query.utils');

/**
 * Validates and converts value to a finite number, or throws ApiError(422)
 * @param {*} value
 * @param {string} message
 * @returns {number}
 */
function requireFiniteNumber(value, message = 'Invalid numeric value') {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, message);
  }
  return parsed;
}

/**
 * Calculate voucher discount amount for an order value.
 * Supports fixed_amount and percentage discounts with maxValue cap.
 * Clamped so it cannot exceed order value or be negative.
 *
 * @param {Object} voucher - Voucher object with { type, value, maxValue }
 * @param {number} orderValue - Normalized order value
 * @returns {number} Calculated discount amount
 */
function calculateVoucherDiscount(voucher, orderValue) {
  if (!voucher) return 0;
  const normalizedOrderValue = requireFiniteNumber(orderValue, 'Invalid order value');

  const type = voucher.type || voucher.discountType;
  const value = voucher.value ?? voucher.discountValue ?? 0;
  const maxCap = voucher.maxValue ?? voucher.maxDiscount;

  let discountAmount = 0;
  if (type === 'fixed_amount' || type === 'fixed') {
    discountAmount = value;
  } else if (type === 'percentage') {
    discountAmount = (normalizedOrderValue * value) / 100;
    if (typeof maxCap === 'number' && maxCap > 0) {
      discountAmount = Math.min(discountAmount, maxCap);
    }
  }

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Voucher discount is invalid');
  }

  return Math.min(discountAmount, normalizedOrderValue);
}

/**
 * Distribute a total platform discount proportionally across multiple orders.
 * The remainder from integer division is assigned to the last order to prevent rounding leaks.
 *
 * @param {Array<Object>} orders - Array of order objects with totalAmount property
 * @param {number} totalPlatformDiscount - Total platform discount to distribute
 * @returns {Array<Object>} Updated orders with discountPlatform and adjusted totalAmount
 */
function distributePlatformDiscount(orders, totalPlatformDiscount) {
  if (!Array.isArray(orders) || orders.length === 0) return orders;

  const totalPlatformOrderValue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  if (totalPlatformOrderValue <= 0 || !totalPlatformDiscount || totalPlatformDiscount <= 0) {
    orders.forEach((order) => {
      order.discountPlatform = 0;
      order.totalAmount = Math.max(0, order.totalAmount || 0);
    });
    return orders;
  }

  let distributedDiscount = 0;
  orders.forEach((order, index) => {
    if (index === orders.length - 1) {
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

  return orders;
}

/**
 * Resolves effective unit price for a product or variant, evaluating:
 * 1. Base price or variant price
 * 2. Active flash sale override (if currently active and quota available)
 *
 * @param {Object} params
 * @param {Object} params.product - Product document or object
 * @param {string|null} [params.variantId] - Variant/model ID if selected
 * @param {Date} [params.now=new Date()] - Evaluation timestamp
 * @returns {{ price: number, isFlashSale: boolean, flashSalePrice: number|null, variant: Object|null, skuCode: string }}
 */
function resolveEffectiveItemPrice({ product, variantId = null, now = new Date() }) {
  if (!product) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Product is required');
  }

  let price = requireFiniteNumber(
    product.price?.currentPrice,
    `Invalid base price for product ${product.name}`,
  );
  let skuCode = '';
  let variant = null;

  if (variantId) {
    const variantIdStr = variantId.toString();
    if (typeof product.variants?.id === 'function') {
      variant = product.variants.id(variantId);
    } else if (Array.isArray(product.variants)) {
      variant = product.variants.find((v) => v?._id?.toString() === variantIdStr);
    }

    if (!variant) {
      throw new ApiError(StatusCodes.NOT_FOUND, `Variation for ${product.name} no longer exists`);
    }

    price = requireFiniteNumber(variant.price, `Invalid variant price for product ${product.name}`);
    skuCode = variant.sku || '';
  }

  // Flash sale override
  const { isFlashSale, salePrice: flashSalePrice } = getProductFlashSale(product, now);
  if (flashSalePrice !== null) {
    price = flashSalePrice;
  }

  return {
    price,
    isFlashSale,
    flashSalePrice,
    variant,
    skuCode,
  };
}

module.exports = {
  requireFiniteNumber,
  calculateVoucherDiscount,
  distributePlatformDiscount,
  resolveEffectiveItemPrice,
};
