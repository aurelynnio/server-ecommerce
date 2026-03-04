const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

/**
 * @desc    Advanced search for products
 * @access  Public
 */
router.get('/', searchController.advancedSearch);

/**
 * @desc    Get search suggestions (autocomplete)
 * @access  Public
 */
router.get('/suggestions', searchController.getSuggestions);

/**
 * @desc    Get trending searches
 * @access  Public
 */
router.get('/trending', searchController.getTrending);

/**
 * @desc    Get hot keywords
 * @access  Public
 */
router.get('/hot-keywords', searchController.getHotKeywords);

module.exports = router;
