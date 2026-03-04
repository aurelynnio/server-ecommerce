const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(verifyAccessToken);

/**
 * @desc    Get current user's wishlist
 * @access  Private
 */
router.get('/', wishlistController.getWishlist);

/**
 * @desc    Get wishlist items count
 * @access  Private
 */
router.get('/count', wishlistController.getWishlistCount);

/**
 * @desc    Check if a product is in user's wishlist
 * @access  Private
 */
router.get('/check/:productId', wishlistController.checkInWishlist);

/**
 * @desc    Check multiple products in wishlist
 * @access  Private
 */
router.post('/check-multiple', wishlistController.checkMultiple);

/**
 * @desc    Add a product to wishlist
 * @access  Private
 */
router.post('/:productId', wishlistController.addToWishlist);

/**
 * @desc    Remove a product from wishlist
 * @access  Private
 */
router.delete('/:productId', wishlistController.removeFromWishlist);

/**
 * @desc    Clear entire wishlist
 * @access  Private
 */
router.delete('/', wishlistController.clearWishlist);

module.exports = router;
