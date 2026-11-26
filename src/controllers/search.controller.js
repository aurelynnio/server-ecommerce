const catchAsync = require('../configs/catchAsync');
const searchService = require('../services/search.service');
const { sendSuccess } = require('../shared/res/formatResponse');
const { parseLimit, parsePagination } = require('../utils/pagination');

// Giữ minPrice=0 (0 là falsy) nhưng bỏ qua giá trị rỗng/không hợp lệ.
const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const SearchController = {
  /**
   * Get suggestions
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSuggestions: catchAsync(async (req, res) => {
    const { q } = req.query;
    const limit = parseLimit(req.query, 10);

    const suggestions = await searchService.getSuggestions(q, limit);

    return sendSuccess(res, suggestions, 'Suggestions retrieved');
  }),

  /**
   * Get trending
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getTrending: catchAsync(async (req, res) => {
    const limit = parseLimit(req.query, 10);

    const trending = await searchService.getTrendingSearches(limit);

    return sendSuccess(res, trending, 'Trending searches retrieved');
  }),

  /**
   * Get hot keywords
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getHotKeywords: catchAsync(async (req, res) => {
    const limit = parseLimit(req.query, 20);

    const keywords = await searchService.getHotKeywords(limit);

    return sendSuccess(res, keywords, 'Hot keywords retrieved');
  }),

  /**
   * Advanced search
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  advancedSearch: catchAsync(async (req, res) => {
    const { q: keyword, category, minPrice, maxPrice, rating, sort } = req.query;
    const { page, limit } = parsePagination(req.query, 20);

    const results = await searchService.advancedSearch({
      keyword,
      category,
      minPrice: toNumberOrUndefined(minPrice),
      maxPrice: toNumberOrUndefined(maxPrice),
      rating: toNumberOrUndefined(rating),
      sortBy: sort,
      page,
      limit,
    });

    return sendSuccess(res, results, 'Search completed');
  }),
};

module.exports = SearchController;
