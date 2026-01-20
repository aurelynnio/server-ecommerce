const catchAsync = require("../configs/catchAsync");
const searchService = require("../services/search.service");
const { sendSuccess } = require("../shared/res/formatResponse");

const SearchController = {
  /**
   * Get search suggestions (autocomplete)

   */
  getSuggestions: catchAsync(async (req, res) => {
    const { q, limit } = req.query;

    const suggestions = await searchService.getSuggestions(
      q,
      parseInt(limit) || 10
    );

    return sendSuccess(res, suggestions, "Suggestions retrieved");
  }),

  /**
   * Get trending searches

   */
  getTrending: catchAsync(async (req, res) => {
    const { limit } = req.query;

    const trending = await searchService.getTrendingSearches(
      parseInt(limit) || 10
    );

    return sendSuccess(res, trending, "Trending searches retrieved");
  }),

  /**
   * Get hot keywords

   */
  getHotKeywords: catchAsync(async (req, res) => {
    const { limit } = req.query;

    const keywords = await searchService.getHotKeywords(parseInt(limit) || 20);

    return sendSuccess(res, keywords, "Hot keywords retrieved");
  }),

  /**
   * Advanced search with filters

   */
  advancedSearch: catchAsync(async (req, res) => {
    const {
      q: keyword,
      category,
      minPrice,
      maxPrice,
      rating,
      sort,
      page,
      limit,
    } = req.query;

    const results = await searchService.advancedSearch({
      keyword,
      category,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      rating: rating ? parseFloat(rating) : undefined,
      sortBy: sort,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return sendSuccess(res, results, "Search completed");
  }),
};

module.exports = SearchController;
