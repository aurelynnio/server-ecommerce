const catchAsync = require("../configs/catchAsync");
const cartService = require("../services/cart.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");


const CartController = {
  // Get user's cart
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

  // Add item to cart
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

  // Update cart item quantity
  updateCartItem: catchAsync(async (req, res) => {


    const userId = req.user.userId;
    const cart = await cartService.updateCartItem(userId, req.params.itemId, req.body.quantity);

    return sendSuccess(
      res,
      cart,
      "Cart item updated successfully",
      StatusCodes.OK
    );
  }),

  // Remove item from cart
  removeCartItem: catchAsync(async (req, res) => {
    const { itemId } = req.params;

    const cart = await cartService.removeCartItem(userId, itemId);

    return sendSuccess(
      res,
      cart,
      "Item removed from cart successfully",
      StatusCodes.OK
    );
  }),

  // Clear cart
  clearCart: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const cart = await cartService.clearCart(userId);

    return sendSuccess(res, cart, "Cart cleared successfully", StatusCodes.OK);
  }),

  // Get cart item count
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
