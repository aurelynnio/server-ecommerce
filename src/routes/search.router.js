const express = require("express");
const router = express.Router();
const searchController = require("../controllers/search.controller");

// Public routes - no authentication required

// Advanced search
router.get("/", searchController.advancedSearch);

// Get search suggestions (autocomplete)
router.get("/suggestions", searchController.getSuggestions);

// Get trending searches
router.get("/trending", searchController.getTrending);

// Get hot keywords
router.get("/hot-keywords", searchController.getHotKeywords);

module.exports = router;
