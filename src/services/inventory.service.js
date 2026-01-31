const Product = require("../models/product.model");
const logger = require("../utils/logger");
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
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      
      if (!product || product.status !== "published") {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          `Product unavailable: ${item.productId}`
        );
      }

      const quantity = item.quantity;

      if (item.modelId) {
        // Variant stock check
        const variant = product.variants.find(
          (v) => v._id.toString() === item.modelId.toString()
        );

        if (!variant) {
          throw new ApiError(
            StatusCodes.NOT_FOUND,
            `Variation not found for product ${product.name}`
          );
        }

        if (variant.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Out of stock for ${product.name} - ${variant.name}`
          );
        }
      } else {
        // Base product stock check
        if (product.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Out of stock for ${product.name}`
          );
        }
      }
    }

    return true;
  }

  /**
   * Deduct stock for multiple items in a transaction
   * @param {Array} items - List of items [{ productId, modelId, quantity }]
   * @param {Object} session - Mongoose session
   */
  async deductStock(items, session) {
    const bulkOps = [];

    // Group items by product to handle multiple variants of same product
    // OR just process sequentially in bulkOps logic
    // Since we need to read current state to update correctly if using $inc, we can use $inc directly
    // But for nested arrays (variants), we need to be careful.

    // Better approach: Read products, update in memory, then bulkWrite specific fields
    // This ensures consistency consistent with current logic
    
    const productIds = items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) continue;

      const quantity = item.quantity;

      if (item.modelId) {
        const variant = product.variants.find(
          (v) => v._id.toString() === item.modelId.toString()
        );
        if (variant) {
            // Check again for safety inside transaction
            if (variant.stock < quantity) {
                throw new ApiError(
                  StatusCodes.CONFLICT,
                  `Out of stock for ${product.name} - ${variant.name}`
                );
            }
            variant.stock -= quantity;
            variant.sold = (variant.sold || 0) + quantity;
        }
      } else {
        if (product.stock < quantity) {
            throw new ApiError(
              StatusCodes.CONFLICT,
              `Out of stock for ${product.name}`
            );
        }
        product.stock -= quantity;
      }
      
      product.soldCount += quantity;
      
      // We will add to bulkOps later. 
      // Since product object is reference, we can iterate all items first then generate bulkOps
    }

    // Generate bulk operations from modified products
    for (const product of productMap.values()) {
        bulkOps.push({
            updateOne: {
                filter: { _id: product._id },
                update: {
                    $set: {
                        stock: product.stock,
                        soldCount: product.soldCount,
                        variants: product.variants // models in schema is actually variants
                    }
                }
            }
        });
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps, { session });
    }
  }

  /**
   * Restore stock for cancelled/failed orders
   * @param {Array} items - List of items [{ productId, modelId, quantity }]
   * @param {Object} session - Mongoose session (optional)
   */
  async restoreStock(items, session = null) {
    const productIds = items.map(item => item.productId);
    // If session provided use it, otherwise don't
    const query = Product.find({ _id: { $in: productIds } });
    if (session) query.session(session);
    
    const products = await query;
    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    const bulkOps = [];

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) continue;

      const quantity = item.quantity;

      if (item.modelId) {
        const variant = product.variants.find(
          (v) => v._id.toString() === item.modelId.toString()
        );
        if (variant) {
          variant.stock += quantity;
          variant.sold = Math.max(0, (variant.sold || 0) - quantity);
        }
      } else {
        product.stock += quantity;
      }
      
      product.soldCount = Math.max(0, product.soldCount - quantity);
    }

    for (const product of productMap.values()) {
        bulkOps.push({
            updateOne: {
                filter: { _id: product._id },
                update: {
                    $set: {
                        stock: product.stock,
                        soldCount: product.soldCount,
                        variants: product.variants
                    }
                }
            }
        });
    }

    if (bulkOps.length > 0) {
      const options = session ? { session } : {};
      await Product.bulkWrite(bulkOps, options);
    }
  }
}

module.exports = new InventoryService();
