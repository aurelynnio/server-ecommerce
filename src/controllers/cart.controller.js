const catchAsync = require("../configs/catchAsync");
const cartService = require("../services/cart.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess } = require("../shared/res/formatResponse");

const CartController = {
  /**
   * Get cart
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Add to cart
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Update cart item
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Remove cart item
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Clear cart
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  clearCart: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const cart = await cartService.clearCart(userId);

    return sendSuccess(res, cart, "Cart cleared successfully", StatusCodes.OK);
  }),

  /**
   * Get cart item count
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
