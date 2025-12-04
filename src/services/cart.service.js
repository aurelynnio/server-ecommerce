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
        select: "name slug images price isActive variants",
        populate: {
          path: "category",
          select: "name slug",
        },
      })
      .lean();

    // Create new cart if doesn't exist
    if (!cart) {
      cart = await Cart.create({ userId, items: [], totalAmount: 0 });
    }

    // Populate variant details for each item
    if (cart && cart.items && cart.items.length > 0) {
      cart.items = cart.items.map((item) => {
        if (item.variantId && item.productId && item.productId.variants) {
          // Find the specific variant from product's variants array
          const variant = item.productId.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
          if (variant) {
            item.variant = {
              _id: variant._id,
              sku: variant.sku,
              color: variant.color,
              size: variant.size,
              stock: variant.stock,
              price: variant.price,
              images: variant.images,
            };
          }
        }
        // Remove variants array from product to keep response clean
        if (item.productId) {
          delete item.productId.variants;
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
   * @param {string} [itemData.variantId] - Variant ID (optional)
   * @param {number} itemData.quantity - Quantity to add
   * @returns {Promise<Object>} Updated cart object
   * @throws {Error} If product/variant not found or out of stock
   */
  async addToCart(userId, itemData) {
    let { productId, variantId, quantity } = itemData;

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    if (!product.isActive) {
      throw new Error("Product is not available");
    }

    // Auto-select first variant if not specified and product has variants
    if (!variantId && product.variants && product.variants.length > 0) {
      variantId = product.variants[0]._id.toString();
    }

    // Get price (from variant or product)
    let price;
    let selectedVariant = null;

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) {
        throw new Error("Variant not found");
      }
      if (variant.stock < quantity) {
        throw new Error(`Only ${variant.stock} items available in stock`);
      }
      price = variant.price;
      selectedVariant = variantId;
    } else {
      // No variants, use product price
      price = product.price;
      selectedVariant = null;
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        (selectedVariant
          ? item.variantId?.toString() === selectedVariant
          : !item.variantId)
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = price;
    } else {
      // Add new item
      cart.items.push({
        productId,
        variantId: selectedVariant,
        quantity,
        price,
      });
    }

    // Calculate total amount
    cart.totalAmount = this.calculateTotal(cart.items);

    await cart.save();

    // Populate and return
    await cart.populate({
      path: "items.productId",
      select: "name slug images price isActive",
    });

    return cart;
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

    // Check product stock
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive) {
      throw new Error("Product is not available");
    }

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      if (!variant || variant.stock < quantity) {
        throw new Error(`Only ${variant?.stock || 0} items available in stock`);
      }
    }

    // Update quantity
    item.quantity = quantity;

    // Recalculate total
    cart.totalAmount = this.calculateTotal(cart.items);

    await cart.save();

    await cart.populate({
      path: "items.productId",
      select: "name slug images price isActive",
    });

    return cart;
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
      const price = item.price.discountPrice || item.price.currentPrice;
      return total + price * item.quantity;
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
