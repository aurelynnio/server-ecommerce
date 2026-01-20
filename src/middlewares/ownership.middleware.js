const { StatusCodes } = require("http-status-codes");
const { sendFail } = require("../shared/res/formatResponse");
const Shop = require("../models/shop.model");
const Product = require("../models/product.model");
const Order = require("../models/order.model");
const logger = require("../utils/logger");

/**
 * Verify that the authenticated user owns a shop
 * Attaches shop to req.shop if verified
 */
const verifyShopOwnership = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?._id;

    if (!userId) {
      return sendFail(res, "Authentication required", StatusCodes.UNAUTHORIZED);
    }

    const shop = await Shop.findOne({ owner: userId });

    if (!shop) {
      return sendFail(
        res,
        "You don't have a shop. Please register a shop first.",
        StatusCodes.FORBIDDEN,
      );
    }

    if (shop.status === "banned") {
      return sendFail(
        res,
        "Your shop has been banned. Please contact support.",
        StatusCodes.FORBIDDEN,
      );
    }

    req.shop = shop;
    next();
  } catch (error) {
    logger.error("verifyShopOwnership error:", { error });
    return sendFail(
      res,
      "Failed to verify shop ownership",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * Verify that the product belongs to the user's shop
 * Must be used after verifyShopOwnership middleware
 * Attaches product to req.product if verified
 */
const verifyProductOwnership = async (req, res, next) => {
  try {
    const productId = req.params.id || req.params.productId;

    if (!productId) {
      return sendFail(res, "Product ID is required", StatusCodes.BAD_REQUEST);
    }

    if (!req.shop) {
      return sendFail(
        res,
        "Shop verification required. Use verifyShopOwnership middleware first.",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const product = await Product.findById(productId);

    if (!product) {
      return sendFail(res, "Product not found", StatusCodes.NOT_FOUND);
    }

    // Compare shop IDs
    if (product.shop.toString() !== req.shop._id.toString()) {
      return sendFail(
        res,
        "You don't have permission to access this product. It belongs to another shop.",
        StatusCodes.FORBIDDEN,
      );
    }

    req.product = product;
    next();
  } catch (error) {
    logger.error("verifyProductOwnership error:", { error });
    return sendFail(
      res,
      "Failed to verify product ownership",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * Verify that the order belongs to the user's shop
 * Must be used after verifyShopOwnership middleware
 * Attaches order to req.order if verified
 */
const verifyOrderOwnership = async (req, res, next) => {
  try {
    const orderId = req.params.orderId || req.params.id;

    if (!orderId) {
      return sendFail(res, "Order ID is required", StatusCodes.BAD_REQUEST);
    }

    if (!req.shop) {
      return sendFail(
        res,
        "Shop verification required. Use verifyShopOwnership middleware first.",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return sendFail(res, "Order not found", StatusCodes.NOT_FOUND);
    }

    // Check if order belongs to seller's shop
    if (order.shopId.toString() !== req.shop._id.toString()) {
      return sendFail(
        res,
        "This order doesn't belong to your shop.",
        StatusCodes.FORBIDDEN,
      );
    }

    req.order = order;
    next();
  } catch (error) {
    logger.error("verifyOrderOwnership error:", { error });
    return sendFail(
      res,
      "Failed to verify order ownership",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

module.exports = {
  verifyShopOwnership,
  verifyProductOwnership,
  verifyOrderOwnership,
};
