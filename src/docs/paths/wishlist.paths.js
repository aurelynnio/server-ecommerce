/**
 * OpenAPI 3.0 Paths: Wishlist Management
 */

module.exports = {
  '/api/wishlist': {
    get: {
      tags: ['Wishlist'],
      summary: 'Get current user wishlist items',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Saved wishlist products' } },
    },
    delete: {
      tags: ['Wishlist'],
      summary: 'Clear entire wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Wishlist cleared' } },
    },
  },
  '/api/wishlist/count': {
    get: {
      tags: ['Wishlist'],
      summary: 'Get count of items in wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Wishlist count' } },
    },
  },
  '/api/wishlist/check/{productId}': {
    get: {
      tags: ['Wishlist'],
      summary: 'Check if product is in wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product wishlist status' } },
    },
  },
  '/api/wishlist/check-multiple': {
    post: {
      tags: ['Wishlist'],
      summary: 'Batch check multiple product IDs in wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['productIds'],
              properties: { productIds: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
      responses: { 200: { description: 'Batch check results' } },
    },
  },
  '/api/wishlist/{productId}': {
    post: {
      tags: ['Wishlist'],
      summary: 'Add product to wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Added to wishlist' } },
    },
    delete: {
      tags: ['Wishlist'],
      summary: 'Remove product from wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Removed from wishlist' } },
    },
  },
};

