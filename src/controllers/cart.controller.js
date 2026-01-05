const catchAsync = require("../configs/catchAsync");
const cartService = require("../services/cart.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Controller for handling shopping cart operations
 */
const CartController = {
  /**
   * Get user's shopping cart
   * @route GET /api/cart
   */
  getCart: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const cart = await cartService.getCart(userId);

    return sendSuccess(
      res,
      cart,
      "Cart retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Add item to cart
   * @route POST /api/cart
   */
  addToCart: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const cart = await cartService.addToCart(userId, req.body);

    return sendSuccess(
      res,
      cart,
      "Item added to cart successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update cart item quantity
   * @route PUT /api/cart/:itemId
   */
  updateCartItem: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const cart = await cartService.updateCartItem(
      userId,
      req.params.itemId,
      req.body.quantity
    );

    return sendSuccess(
      res,
      cart,
      "Cart item updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Remove item from cart
   * @route DELETE /api/cart/:itemId
   */
  removeCartItem: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const { itemId } = req.params;

    const cart = await cartService.removeCartItem(userId, itemId);

    return sendSuccess(
      res,
      cart,
      "Item removed from cart successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Clear all items from cart
   * @route DELETE /api/cart
   */
  clearCart: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const cart = await cartService.clearCart(userId);

    return sendSuccess(res, cart, "Cart cleared successfully", StatusCodes.OK);
  }),

  /**
   * Get cart item count
   * @route GET /api/cart/count
   */
  getCartItemCount: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const count = await cartService.getCartItemCount(userId);

    return sendSuccess(
      res,
      { count },
      "Cart item count retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = CartController;
