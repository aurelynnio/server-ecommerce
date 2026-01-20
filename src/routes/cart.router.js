
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
* @desc Get user's cart
* @accessPrivate (Authenticated users)
 */

router.get("/", cartController.getCart);
/**
* @desc Get cart item count
* @accessPrivate (Authenticated users)
 */

router.get("/count", cartController.getCartItemCount);
/**
* @desc Add item to cart
* @accessPrivate (Authenticated users)
 * @body    { productId, variantId?, quantity }
 */

router.post("/", validate(addToCartValidator), cartController.addToCart);
/**
* @desc Update cart item quantity
* @accessPrivate (Authenticated users)
 * @body    { quantity }
 */

router.put(
  "/:itemId",
  validate({ params: cartItemIdValidator, body: updateCartItemValidator }),
  cartController.updateCartItem
);
/**
* @desc Remove item from cart
* @accessPrivate (Authenticated users)
 */

router.delete(
  "/:itemId",
  validate({ params: cartItemIdValidator }),
  cartController.removeCartItem
);
/**
* @desc Clear cart
* @accessPrivate (Authenticated users)
 */

router.delete("/", cartController.clearCart);

module.exports = router;
