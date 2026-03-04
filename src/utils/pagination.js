/**
 * Generate pagination parameters for MongoDB queries
 * @param {Number} currentPage - Current page number (starts from 1)
 * @param {Number} pageSize - Number of items per page
 * @param {Number} totalItems - Total count from database
 * @returns {Object} Pagination metadata with skip/limit for MongoDB
 */
const getPaginationParams = (currentPage = 1, pageSize = 10, totalItems = 0) => {
  // Validate and sanitize inputs
  const page = Math.max(1, parseInt(currentPage) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(pageSize) || 10)); // Max 100 items per page

  const totalPages = Math.ceil(totalItems / limit) || 1;
  const skip = (page - 1) * limit;

  return {
    skip,
    limit,
    currentPage: page,
    pageSize: limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
};

/**
 * Build standardized pagination response
 * @param {Array} data - Paginated data from database
 * @param {Object} params - Pagination params from getPaginationParams
 * @returns {Object} Formatted response with data and pagination metadata
 */
const buildPaginationResponse = (data, params) => {
  return {
    data,
    pagination: {
      currentPage: params.currentPage,
      pageSize: params.pageSize,
      totalItems: params.totalItems,
      totalPages: params.totalPages,
      hasNextPage: params.hasNextPage,
      hasPrevPage: params.hasPrevPage,
      nextPage: params.nextPage,
      prevPage: params.prevPage,
    },
  };
};

module.exports = {
  getPaginationParams,
  buildPaginationResponse,
};
