const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

/**
 * Service handling shopping cart operations
 * Manages adding items, updating quantities, and retrieving cart details
 */
class CartService {
  /**
   * Retrieve user's shopping cart with full product details
   * @param {string} userId - The ID of the user
   * @returns {Promise<Object>} The populated cart object
   */
  async getCart(userId) {
    let cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "name slug images price status tierVariations models shop variants sizes",
        populate: [
          { path: "category", select: "name slug" },
          { path: "shop", select: "name logo" },
        ],
      })
      .populate({
        path: "items.shopId",
        select: "name logo",
      })
      .lean();

    // Create new cart if doesn't exist
    if (!cart) {
      cart = await Cart.create({ userId, items: [], totalAmount: 0 });
    }

    // Populate variation details for each item
    if (cart && cart.items && cart.items.length > 0) {
      cart.items = cart.items.map((item) => {
        const product = item.productId;
        if (!product) return item;

        // Handle color variants
        if (item.variantId && product.variants && product.variants.length > 0) {
          const variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
          if (variant) {
            item.variant = {
              _id: variant._id,
              name: variant.name,
              color: variant.color,
              images: variant.images,
              price: variant.price,
              stock: variant.stock,
            };
            // Override price from variant
            item.price = { currentPrice: variant.price, currency: "VND" };
            
            // Build variationInfo string
            const parts = [];
            if (variant.color) parts.push(variant.color);
            if (item.size) parts.push(`Size: ${item.size}`);
            if (parts.length > 0) {
              item.variationInfo = parts.join(', ');
            }
          }
        }
        // Backward compatibility: Check modelId for variants
        else if (item.modelId && product.variants && product.variants.length > 0) {
          const variant = product.variants.find(
            (v) => v._id.toString() === item.modelId.toString()
          );
          if (variant) {
            item.variant = {
              _id: variant._id,
              name: variant.name,
              color: variant.color,
              images: variant.images,
              price: variant.price,
              stock: variant.stock,
            };
            item.variantId = variant._id;
            item.price = { currentPrice: variant.price, currency: "VND" };
            
            const parts = [];
            if (variant.color) parts.push(variant.color);
            if (item.size) parts.push(`Size: ${item.size}`);
            if (parts.length > 0) {
              item.variationInfo = parts.join(', ');
            }
          }
        }
        // Handle legacy Tier Variations (SKU)
        else if (item.modelId && product.models) {
          const model = product.models.find(
            (m) => m._id.toString() === item.modelId.toString()
          );
          if (model) {
            // Map tierIndex to actual names (e.g., [0, 0] -> "Red", "S")
            const variationOptions = model.tierIndex.map((tIdx, i) => {
              return product.tierVariations?.[i]?.options[tIdx] || "";
            });

            item.model = {
              _id: model._id,
              sku: model.sku,
              price: model.price,
              stock: model.stock,
              name: variationOptions.join(" - "),
            };

            item.variationInfo = variationOptions.join(" - ");
            item.price = { currentPrice: model.price, currency: "VND" };
          }
        }

        // Denormalized Shop Info (if not populated deep enough)
        if (!item.shopId && product.shop) {
          item.shopId = product.shop._id || product.shop;
        }

        // Clean up large objects to reduce payload
        if (item.productId) {
          delete item.productId.models;
          delete item.productId.tierVariations;
          // Keep variants for image fallback but remove detailed info
          if (item.productId.variants) {
            item.productId.variants = item.productId.variants.map(v => ({
              _id: v._id,
              images: v.images,
            }));
          }
        }
        return item;
      });
    }

    return cart;
  }

  /**
   * Add an item to the user's cart
   * @param {string} userId - The ID of the user
   * @param {Object} itemData - Item details
   * @param {string} itemData.productId - Product ID
   * @param {string} [itemData.modelId] - Model/Variant ID (optional)
   * @param {string} [itemData.size] - Size selection (optional)
   * @param {number} itemData.quantity - Quantity to add
   * @returns {Promise<Object>} Updated cart object
   * @throws {Error} If product/variant not found or out of stock
   */
  async addToCart(userId, itemData) {
    const { productId, modelId, size, quantity } = itemData;

    // Validate quantity
    if (!quantity || quantity < 1) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Quantity must be at least 1"
      );
    }

    // Check if product exists and is published
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
    }
    if (product.status !== "published") {
      throw new ApiError(StatusCodes.CONFLICT, "Product is not available");
    }

    // Validate size selection if product has sizes
    if (product.sizes && product.sizes.length > 0) {
      if (!size) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Please select a size");
      }
      if (!product.sizes.includes(size)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid size selected");
      }
    }

    // Get Shop ID
    const shopId = product.shop;

    // Determine Price & Variant
    let price = product.price?.currentPrice || 0;
    let selectedVariantId = null;

    // Handle color variants
    if (product.variants && product.variants.length > 0) {
      if (modelId) {
        // Find variant by ID
        const variant = product.variants.find((v) => v._id.toString() === modelId);
        if (!variant) {
          throw new ApiError(StatusCodes.NOT_FOUND, "Variant not found");
        }

        if (variant.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Only ${variant.stock} item(s) available`
          );
        }
        price = variant.price;
        selectedVariantId = modelId;
      } else {
        // Default to first variant if not specified
        const variant = product.variants[0];
        if (variant.stock < quantity) {
          throw new ApiError(StatusCodes.CONFLICT, "Out of stock");
        }
        price = variant.price;
        selectedVariantId = variant._id.toString();
      }
    }
    // Handle legacy tier variations
    else if (product.models && product.models.length > 0) {
      if (modelId) {
        const model = product.models.find((m) => m._id.toString() === modelId);
        if (!model) {
          throw new ApiError(StatusCodes.NOT_FOUND, "Model variation not found");
        }

        if (model.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Only ${model.stock} item(s) available`
          );
        }
        price = model.price;
        selectedVariantId = modelId;
      } else {
        const model = product.models[0];
        if (model.stock < quantity) {
          throw new ApiError(StatusCodes.CONFLICT, "Out of stock");
        }
        price = model.price;
        selectedVariantId = model._id.toString();
      }
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if item exists (same product + variant + size)
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        (selectedVariantId
          ? (item.modelId?.toString() === selectedVariantId.toString() || 
             item.variantId?.toString() === selectedVariantId.toString())
          : (!item.modelId && !item.variantId)) &&
        (size ? item.size === size : !item.size)
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
      // Update price if changed
      cart.items[existingItemIndex].price = {
        currentPrice: price,
        currency: "VND",
      };
    } else {
      cart.items.push({
        productId,
        shopId,
        modelId: selectedVariantId,
        variantId: selectedVariantId,
        size: size || null,
        quantity,
        price: { currentPrice: price, currency: "VND" },
      });
    }

    // Calculate total
    cart.totalAmount = this.calculateTotal(cart.items);
    await cart.save();

    return this.getCart(userId); // Return full populated cart
  }

  /**
   * Update cart item quantity
   * @param {string} userId - User ID
   * @param {string} itemId - Cart item ID
   * @param {number} quantity - New quantity
   * @returns {Promise<Object>} Updated cart
   * @throws {Error} If cart or item not found, or stock is insufficient
   */
  async updateCartItem(userId, itemId, quantity) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Item not found in cart");
    }

    // If quantity is 0 or less, remove the item
    if (quantity <= 0) {
      return this.removeCartItem(userId, itemId);
    }

    // Check product stock
    const product = await Product.findById(item.productId);
    if (!product || product.status !== "published") {
      throw new ApiError(StatusCodes.CONFLICT, "Product is not available");
    }

    // Only validate stock when INCREASING quantity
    const isIncreasing = quantity > item.quantity;
    
    if (isIncreasing) {
      // Check variantId first
      if (item.variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
        if (!variant) {
          throw new ApiError(StatusCodes.NOT_FOUND, "Product variant not found");
        }
        if (variant.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Only ${variant.stock} item(s) available`
          );
        }
      }
      // Check modelId for tier variations (legacy)
      else if (item.modelId && product.models && product.models.length > 0) {
        const model = product.models.find(
          (m) => m._id.toString() === item.modelId.toString()
        );
        if (!model) {
          throw new ApiError(StatusCodes.NOT_FOUND, "Product variation not found");
        }
        if (model.stock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Only ${model.stock} item(s) available`
          );
        }
      } else {
        // Simple Product stock
        const availableStock = product.stock ?? product.quantity ?? 999;
        if (availableStock < quantity) {
          throw new ApiError(
            StatusCodes.CONFLICT,
            `Only ${availableStock} item(s) available`
          );
        }
      }
    }

    // Update quantity
    item.quantity = quantity;

    // Recalculate total
    cart.totalAmount = this.calculateTotal(cart.items);

    await cart.save();

    return this.getCart(userId);
  }

  /**
   * Remove an item from cart
   * @param {string} userId - User ID
   * @param {string} itemId - Cart item ID
   * @returns {Promise<Object>} Updated cart
   * @throws {Error} If cart not found
   */
  async removeCartItem(userId, itemId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }

    // Remove item using pull
    cart.items.pull(itemId);

    // Recalculate total
    cart.totalAmount = this.calculateTotal(cart.items);

    await cart.save();

    await cart.populate({
      path: "items.productId",
      select: "name slug images price status",
    });

    return cart;
  }

  /**
   * Clear all items from cart
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cleared cart
   * @throws {Error} If cart not found
   */
  async clearCart(userId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }

    cart.items = [];
    cart.totalAmount = 0;

    await cart.save();

    return cart;
  }

  /**
   * Calculate total amount for cart items
   * @param {Array} items - Cart items
   * @returns {number} Total amount
   */
  calculateTotal(items) {
    return items.reduce((total, item) => {
      const price = item.price?.discountPrice || item.price?.currentPrice || 0;
      return total + price * (item.quantity || 0);
    }, 0);
  }

  /**
   * Get total item count in user's cart
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total item count
   */
  async getCartItemCount(userId) {
    const cart = await Cart.findOne({ userId }).lean();
    if (!cart) {
      return 0;
    }

    return cart.items.reduce((count, item) => count + item.quantity, 0);
  }

  /**
   * Find a cart item by a list of item IDs
   * @param {Object} cart - Cart document
   * @param {string[]} listIds - List of cart item IDs
   * @returns {Object|null} Matching cart item or null
   */
  getCartItemWithListIds(cart, listIds) {
    if (!cart || !cart.items) return null;
    return cart.items.find((item) => listIds.includes(item._id.toString()));
  }
}

module.exports = new CartService();
