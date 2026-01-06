const Cart = require("../models/cart.model");
const Product = require("../models/product.model");

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
        select: "name slug images price isActive tierVariations models shop",
        populate: [
          { path: "category", select: "name slug" },
          { path: "shop", select: "name logo" },
        ],
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

        // Handle Tier Variations (SKU)
        if (item.modelId && product && product.models) {
          const model = product.models.find(
            (m) => m._id.toString() === item.modelId.toString()
          );
          if (model) {
            // Map tierIndex to actual names (e.g., [0, 0] -> "Red", "S")
            const variationOptions = model.tierIndex.map((tIdx, i) => {
              return product.tierVariations[i]?.options[tIdx] || "";
            });

            item.model = {
              _id: model._id,
              sku: model.sku,
              price: model.price,
              stock: model.stock,
              // human readable variation
              name: variationOptions.join(" - "),
            };

            // Override visible price/image if needed
            item.price = { currentPrice: model.price, currency: "VND" };
          }
        }

        // Denormalized Shop Info (if not populated deep enough)
        if (!item.shopId && product.shop) {
          item.shopId = product.shop._id;
        }

        // Clean up large objects
        if (item.productId) {
          delete item.productId.models;
          delete item.productId.tierVariations;
        }
        return item;
      });

      // Group by Shop (optional, logic can be in Frontend or mapped here)
      // Frontend often expects flat list, but grouped is better.
      // Keeping flat list for now to minimize breaking changes, Frontend can group by shopId.
    }

    return cart;
  }

  /**
   * Add an item to the user's cart
   * @param {string} userId - The ID of the user
   * @param {Object} itemData - Item details
   * @param {string} itemData.productId - Product ID
   * @param {string} [itemData.variantId] - Variant ID (optional)
   * @param {number} itemData.quantity - Quantity to add
   * @returns {Promise<Object>} Updated cart object
   * @throws {Error} If product/variant not found or out of stock
   */
  async addToCart(userId, itemData) {
    let { productId, modelId, quantity } = itemData;

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");
    if (!product.isActive) throw new Error("Product is not available");

    // Get Shop ID
    const shopId = product.shop;

    // Determine Price & Model
    let price = product.price.currentPrice;
    let selectedModel = null;

    if (modelId) {
      // Find model in product.models
      const model = product.models.find((m) => m._id.toString() === modelId);
      if (!model) throw new Error("Model variation not found");

      if (model.stock < quantity) {
        throw new Error(`Only ${model.stock} item(s) available`);
      }
      price = model.price;
      selectedModel = modelId;
    } else if (product.models && product.models.length > 0) {
      // If product has variations but user didn't select one
      // Default to first capable model? Or throw error?
      // Taobao requires selection. For now, default to first.
      const model = product.models[0];
      if (model.stock < quantity) throw new Error(`Out of stock`);
      price = model.price;
      selectedModel = model._id.toString();
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if item exists
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        (selectedModel
          ? item.modelId?.toString() === selectedModel.toString()
          : !item.modelId)
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
        modelId: selectedModel,
        quantity,
        price: { currentPrice: price, currency: "VND" },
      });
    }

    // Calculate total
    cart.totalAmount = this.calculateTotal(cart.items);
    await cart.save();

    return this.getCart(userId); // Return full populated cart
  }

  // Update cart item quantity
  async updateCartItem(userId, itemId, quantity) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new Error("Cart not found");
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new Error("Item not found in cart");
    }

    // If quantity is 0 or less, remove the item
    if (quantity <= 0) {
      return this.removeCartItem(userId, itemId);
    }

    // Check product stock
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive) {
      throw new Error("Product is not available");
    }

    // Only validate stock when INCREASING quantity
    const isIncreasing = quantity > item.quantity;
    
    if (isIncreasing) {
      if (item.modelId) {
        // Validate against Model (Tier Variation)
        if (!product.models) throw new Error("Product structure changed");

        const model = product.models.find(
          (m) => m._id.toString() === item.modelId.toString()
        );
        if (!model) {
          throw new Error("Product variation not found");
        }

        if (model.stock < quantity) {
          throw new Error(`Only ${model.stock} item(s) available`);
        }
      } else {
        // Simple Product stock
        const availableStock = product.stock ?? product.quantity ?? 999;
        if (availableStock < quantity) {
          throw new Error(`Only ${availableStock} item(s) available`);
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

  // Remove item from cart
  async removeCartItem(userId, itemId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new Error("Cart not found");
    }

    // Remove item using pull
    cart.items.pull(itemId);

    // Recalculate total
    cart.totalAmount = this.calculateTotal(cart.items);

    await cart.save();

    await cart.populate({
      path: "items.productId",
      select: "name slug images price isActive",
    });

    return cart;
  }

  // Clear cart
  async clearCart(userId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new Error("Cart not found");
    }

    cart.items = [];
    cart.totalAmount = 0;

    await cart.save();

    return cart;
  }

  // Calculate total amount helper
  calculateTotal(items) {
    return items.reduce((total, item) => {
      const price = item.price?.discountPrice || item.price?.currentPrice || 0;
      return total + price * (item.quantity || 0);
    }, 0);
  }

  // Get cart item count
  async getCartItemCount(userId) {
    const cart = await Cart.findOne({ userId }).lean();
    if (!cart) {
      return 0;
    }

    return cart.items.reduce((count, item) => count + item.quantity, 0);
  }

  getCartItemWithListIds(cart, listIds) {
    if (!cart || !cart.items) return null;
    return cart.items.find((item) => listIds.includes(item._id.toString()));
  }
}

module.exports = new CartService();
