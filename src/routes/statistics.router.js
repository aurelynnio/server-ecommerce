const express = require('express');

const router = express.Router();

const statisticsController = require('../controllers/statistics.controller');

const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');
// All routes require admin permission

router.use(verifyAccessToken, requireRole('admin'));

/**
 * @desc    Get dashboard statistics overview
 * @access  Private (Admin only)
 * @returns {Object} Dashboard statistics (users, orders, revenue, products, etc.)
 */
router.get('/dashboard', statisticsController.getDashboardStats);

module.exports = router;
