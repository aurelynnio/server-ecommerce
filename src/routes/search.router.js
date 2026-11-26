const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const validate = require('../middlewares/validate.middleware');
const {
  searchQueryValidator,
  suggestionQueryValidator,
  trendingQueryValidator,
  hotKeywordsQueryValidator,
} = require('../validations/search.validator');

/**
 * @desc    Advanced search for products
 * @access  Public
 */
router.get('/', validate({ query: searchQueryValidator }), searchController.advancedSearch);

/**
 * @desc    Get search suggestions (autocomplete)
 * @access  Public
 */
router.get(
  '/suggestions',
  validate({ query: suggestionQueryValidator }),
  searchController.getSuggestions,
);

/**
 * @desc    Get trending searches
 * @access  Public
 */
router.get('/trending', validate({ query: trendingQueryValidator }), searchController.getTrending);

/**
 * @desc    Get hot keywords
 * @access  Public
 */
router.get(
  '/hot-keywords',
  validate({ query: hotKeywordsQueryValidator }),
  searchController.getHotKeywords,
);

module.exports = router;
