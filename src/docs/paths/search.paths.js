/**
 * OpenAPI 3.0 Paths: Advanced Search & Autocomplete
 */

module.exports = {
  '/api/search': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Advanced multi-field search across catalog',
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'brand', in: 'query', schema: { type: 'string' } },
        { name: 'minPrice', in: 'query', schema: { type: 'number' } },
        { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
        { name: 'rating', in: 'query', schema: { type: 'number' } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { 200: { description: 'Search results' } },
    },
  },
  '/api/search/suggestions': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get search autocomplete query suggestions',
      parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Suggestions list' } },
    },
  },
  '/api/search/trending': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get trending search keywords',
      responses: { 200: { description: 'Trending search queries' } },
    },
  },
  '/api/search/hot-keywords': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get hot promotional keyword chips',
      responses: { 200: { description: 'Hot keywords list' } },
    },
  },
};

