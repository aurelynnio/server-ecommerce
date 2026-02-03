const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("./errorHandler.middleware");
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
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required");
    }

    const shop = await Shop.findOne({ owner: userId });

    if (!shop) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You don't have a shop. Please register a shop first.",
      );
    }

    if (shop.status === "banned") {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Your shop has been banned. Please contact support.",
      );
    }

    req.shop = shop;
    next();
  } catch (error) {
    logger.error("verifyShopOwnership error:", { error });
    next(error);
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
      throw new ApiError(StatusCodes.BAD_REQUEST, "Product ID is required");
    }

    if (!req.shop) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Shop verification required. Use verifyShopOwnership middleware first.",
      );
    }

    const product = await Product.findById(productId);

    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }

    if (product.shop.toString() !== req.shop._id.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You don't have permission to access this product. It belongs to another shop.",
      );
    }

    req.product = product;
    next();
  } catch (error) {
    logger.error("verifyProductOwnership error:", { error });
    next(error);
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
      throw new ApiError(StatusCodes.BAD_REQUEST, "Order ID is required");
    }

    if (!req.shop) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Shop verification required. Use verifyShopOwnership middleware first.",
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
    }

    if (order.shopId.toString() !== req.shop._id.toString()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "This order doesn't belong to your shop.",
      );
    }

    req.order = order;
    next();
  } catch (error) {
    logger.error("verifyOrderOwnership error:", { error });
    next(error);
  }
};

module.exports = {
  verifyShopOwnership,
  verifyProductOwnership,
  verifyOrderOwnership,
};

