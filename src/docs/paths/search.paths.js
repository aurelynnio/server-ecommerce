/**
 * OpenAPI 3.0 Paths: Advanced Search & Autocomplete
 */

module.exports = {
  '/api/search': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Advanced multi-field search across catalog',
      parameters: [
        { name: 'q', in: 'query', required: false, schema: { type: 'string', maxLength: 200 } },
        { name: 'category', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'minPrice', in: 'query', schema: { type: 'number', minimum: 0 } },
        { name: 'maxPrice', in: 'query', schema: { type: 'number', minimum: 0 } },
        { name: 'rating', in: 'query', schema: { type: 'number', minimum: 1, maximum: 5 } },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['relevance', 'price_asc', 'price_desc', 'rating', 'newest', 'bestselling'],
          },
        },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
      ],
      responses: { 200: { description: 'Search results' } },
    },
  },
  '/api/search/suggestions': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get search autocomplete query suggestions',
      parameters: [
        { name: 'q', in: 'query', required: false, schema: { type: 'string', maxLength: 200 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 20 } },
      ],
      responses: { 200: { description: 'Suggestions list' } },
    },
  },
  '/api/search/trending': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get trending search keywords',
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 } },
      ],
      responses: { 200: { description: 'Trending search queries' } },
    },
  },
  '/api/search/hot-keywords': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get hot promotional keyword chips',
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 50 } },
      ],
      responses: { 200: { description: 'Hot keywords list' } },
    },
  },
};
