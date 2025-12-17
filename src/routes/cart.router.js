const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  addToCartValidator,
  updateCartItemValidator,
  cartItemIdValidator,
} = require("../validations/cart.validator");

// All cart routes require authentication
router.use(verifyAccessToken);

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Private (Authenticated users)
 */
router.get("/", cartController.getCart);

/**
 * @route   GET /api/cart/count
 * @desc    Get cart item count
 * @access  Private (Authenticated users)
 */
router.get("/count", cartController.getCartItemCount);

/**
 * @route   POST /api/cart
 * @desc    Add item to cart
 * @access  Private (Authenticated users)
 * @body    { productId, variantId?, quantity }
 */
router.post("/", validate(addToCartValidator), cartController.addToCart);

/**
 * @route   PUT /api/cart/:itemId
 * @desc    Update cart item quantity
 * @access  Private (Authenticated users)
 * @body    { quantity }
 */
router.put(
  "/:itemId",
  validate({ params: cartItemIdValidator, body: updateCartItemValidator }),
  cartController.updateCartItem
);

/**
 * @route   DELETE /api/cart/:itemId
 * @desc    Remove item from cart
 * @access  Private (Authenticated users)
 */
router.delete(
  "/:itemId",
  validate({ params: cartItemIdValidator }),
  cartController.removeCartItem
);

/**
 * @route   DELETE /api/cart
 * @desc    Clear cart
 * @access  Private (Authenticated users)
 */
router.delete("/", cartController.clearCart);

module.exports = router;

