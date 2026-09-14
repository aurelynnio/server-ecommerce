/**
 * Utilities for flash sale status, pricing, and quota validation.
 * Centralizes logic previously duplicated across models, services, and scripts.
 */

/**
 * Check if a flash sale is within its active time window (regardless of quota)
 * @param {Object} flashSale
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isFlashSaleTimeWindowActive(flashSale, now = new Date()) {
  if (!flashSale?.isActive) return false;
  const startTime = new Date(flashSale.startTime);
  const endTime = new Date(flashSale.endTime);
  return startTime <= now && endTime > now;
}

/**
 * Check if a flash sale is active, within time window, and has available quota
 * @param {Object} flashSale
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isFlashSaleActive(flashSale, now = new Date()) {
  if (!isFlashSaleTimeWindowActive(flashSale, now)) {
    return false;
  }
  return !flashSale.stock || (flashSale.soldCount || 0) < flashSale.stock;
}

/**
 * Extract active flash sale state and sale price for a product
 * @param {Object} product
 * @param {Date} [now=new Date()]
 * @returns {{ isFlashSale: boolean, salePrice: number|null }}
 */
function getProductFlashSale(product, now = new Date()) {
  const isFlashSale = isFlashSaleActive(product?.flashSale, now);
  const salePrice =
    isFlashSale && Number.isFinite(product?.flashSale?.salePrice)
      ? product.flashSale.salePrice
      : null;
  return { isFlashSale, salePrice };
}

module.exports = {
  isFlashSaleTimeWindowActive,
  isFlashSaleActive,
  getProductFlashSale,
};
