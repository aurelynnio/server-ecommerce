/**
 * OpenAPI 3.0 Paths: Recommendations Engine
 */

module.exports = {
  '/api/recommendations/for-you': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get personalized product feed for user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Personalized product list' } },
    },
  },
  '/api/recommendations/homepage': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get curated homepage recommendations',
      responses: { 200: { description: 'Homepage products' } },
    },
  },
  '/api/recommendations/recently-viewed': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get recently viewed products for user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Recently viewed items' } },
    },
  },
  '/api/recommendations/track-view/{productId}': {
    post: {
      tags: ['Search & Discovery'],
      summary: 'Track product view event to train user preferences',
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'View tracked' } },
    },
  },
  '/api/recommendations/fbt/{productId}': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get frequently bought together products',
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'FBT products' } },
    },
  },
  '/api/recommendations/similar/{productId}': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get visually and contextually similar products',
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Similar products' } },
    },
  },
  '/api/recommendations/category/{categoryId}': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get top recommendations within category',
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Category recommendations' } },
    },
  },
};

