const Product = require("../repositories/product.repository");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

/**
 * Service handling inventory operations
 * Manages stock checking, reservation, deduction, and restoration
 */
class InventoryService {
  /**
   * Check if products have sufficient stock
   * @param {Array} items - List of items [{ productId, modelId, quantity }]
   * @returns {Promise<boolean>} true if all items available
   * @throws {Error} If any item is out of stock or unavailable
   */
  async checkStockAvailability(items) {
    const productIds = items.map((item) => item.productId);
    const products = await Product.findByIds(productIds);
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    for (const item of items) {
      const product = productMap.get(item.productId.toString());

      if (!product || product.status !== "published") {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          `Product unavailable: ${item.productId}`,
        );
      }

      const quantity = item.quantity;

      if (item.modelId) {
        // Variant stock check
        const variant = product.variants.find(
          (v) => v._id.toString() === item.modelId.toString(),
        );

        if (!variant) {
          throw new ApiError(
            StatusCodes.NOT_FOUND,
            `Variation not found for product ${product.name}`,
          );
        }

        if (variant.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Out of stock for ${product.name} - ${variant.name}`,
          );
        }
      } else {
        // Base product stock check
        if (product.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Out of stock for ${product.name}`,
          );
        }
      }
    }

    return true;
  }

  /**
   * Aggregate quantities for identical product+variant pairs
   * @param {Array} items
   * @returns {Array}
   */
  aggregateItems(items) {
    const map = new Map();
    for (const item of items) {
      const productId = item.productId.toString();
      const modelId = item.modelId ? item.modelId.toString() : null;
      const key = `${productId}:${modelId || "base"}`;
      const current = map.get(key) || { productId, modelId, quantity: 0 };
      current.quantity += item.quantity;
      map.set(key, current);
    }
    return Array.from(map.values());
  }

  /**
   * Deduct stock for multiple items in a transaction
   * @param {Array} items - List of items [{ productId, modelId, quantity }]
   * @param {Object} session - Mongoose session
   */
  async deductStock(items, session) {
    const aggregatedItems = this.aggregateItems(items);

    for (const item of aggregatedItems) {
      const quantity = item.quantity;
      if (item.modelId) {
        const result = await Product.decrementStockForVariantSale(
          item.productId,
          item.modelId,
          quantity,
          session,
        );

        if (!result.matchedCount) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            "Out of stock or variation unavailable",
          );
        }
      } else {
        const result = await Product.decrementStockForBaseSale(
          item.productId,
          quantity,
          session,
        );

        if (!result.matchedCount) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            "Out of stock or product unavailable",
          );
        }
      }
    }
  }

  /**
   * Restore stock for cancelled/failed orders
   * @param {Array} items - List of items [{ productId, modelId, quantity }]
   * @param {Object} session - Mongoose session (optional)
   */
  async restoreStock(items, session = null) {
    const aggregatedItems = this.aggregateItems(items);
    const options = session ? { session } : {};

    for (const item of aggregatedItems) {
      const quantity = item.quantity;
      if (item.modelId) {
        await Product.restoreStockForVariant(
          item.productId,
          item.modelId,
          quantity,
          options,
        );
      } else {
        await Product.restoreStockForBaseProduct(
          item.productId,
          quantity,
          options,
        );
      }
    }
  }
}

module.exports = new InventoryService();
