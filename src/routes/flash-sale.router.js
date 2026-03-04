const express = require('express');
const router = express.Router();
const flashSaleController = require('../controllers/flash-sale.controller');
const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');

/**
 * @desc    Get active flash sale products
 * @access  Public
 */
router.get('/', flashSaleController.getActiveFlashSale);

/**
 * @desc    Get flash sale schedule
 * @access  Public
 */
router.get('/schedule', flashSaleController.getSchedule);

/**
 * @desc    Get flash sale by time slot
 * @access  Public
 */
router.get('/slot/:timeSlot', flashSaleController.getBySlot);

/**
 * @desc    Get flash sale statistics
 * @access  Private (Admin)
 */
router.get('/stats', verifyAccessToken, requireRole('admin'), flashSaleController.getStats);

/**
 * @desc    Add product to flash sale
 * @access  Private (Admin/Seller)
 */
router.post(
  '/:productId',
  verifyAccessToken,
  requireRole('admin', 'seller'),
  flashSaleController.addToFlashSale,
);

/**
 * @desc    Remove product from flash sale
 * @access  Private (Admin/Seller)
 */
router.delete(
  '/:productId',
  verifyAccessToken,
  requireRole('admin', 'seller'),
  flashSaleController.removeFromFlashSale,
);

module.exports = router;
