const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishlist.controller");
const { authenticate } = require("../middlewares/auth.middleware");

// All routes require authentication
router.use(authenticate);

// Get wishlist
router.get("/", wishlistController.getWishlist);

// Get wishlist count
router.get("/count", wishlistController.getWishlistCount);

// Check if product is in wishlist
router.get("/check/:productId", wishlistController.checkInWishlist);

// Check multiple products
router.post("/check-multiple", wishlistController.checkMultiple);

// Add to wishlist
router.post("/:productId", wishlistController.addToWishlist);

// Remove from wishlist
router.delete("/:productId", wishlistController.removeFromWishlist);

// Clear wishlist
router.delete("/", wishlistController.clearWishlist);

module.exports = router;
