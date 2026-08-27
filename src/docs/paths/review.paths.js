/**
 * OpenAPI 3.0 Paths: Reviews & Ratings Management
 */

module.exports = {
  '/api/reviews/product/{productId}': {
    get: {
      tags: ['Reviews'],
      summary: 'Get all reviews for a product',
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product reviews list' } },
    },
  },
  '/api/reviews/shop/{shopId}': {
    get: {
      tags: ['Reviews'],
      summary: 'Get all public reviews for a shop',
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop reviews list' } },
    },
  },
  '/api/reviews/user/me': {
    get: {
      tags: ['Reviews'],
      summary: 'Get current user reviews',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'My reviews' } },
    },
  },
  '/api/reviews/check/{productId}': {
    get: {
      tags: ['Reviews'],
      summary: 'Check if user can review a product (Must have purchased)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Review eligibility status' } },
    },
  },
  '/api/reviews': {
    get: {
      tags: ['Reviews'],
      summary: 'Get all reviews (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'All reviews' } },
    },
    post: {
      tags: ['Reviews'],
      summary: 'Create product review (Verified buyer)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['productId', 'rating', 'comment'],
              properties: {
                productId: { type: 'string' },
                rating: { type: 'integer', minimum: 1, maximum: 5 },
                comment: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Review created' } },
    },
  },
  '/api/reviews/seller/me': {
    get: {
      tags: ['Reviews'],
      summary: 'Get reviews for seller shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Seller reviews' } },
    },
  },
  '/api/reviews/seller/{reviewId}/reply': {
    post: {
      tags: ['Reviews'],
      summary: 'Seller replies to customer review',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'reviewId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['comment'],
              properties: { comment: { type: 'string' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Reply posted' } },
    },
  },
  '/api/reviews/statistics/overview': {
    get: {
      tags: ['Reviews'],
      summary: 'Get platform-wide review statistics (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Review analytics' } },
    },
  },
  '/api/reviews/{reviewId}': {
    get: {
      tags: ['Reviews'],
      summary: 'Get review details by ID',
      parameters: [{ name: 'reviewId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Review details' } },
    },
    put: {
      tags: ['Reviews'],
      summary: 'Update own review',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'reviewId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Review updated' } },
    },
    delete: {
      tags: ['Reviews'],
      summary: 'Delete review (Owner or Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'reviewId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Review deleted' } },
    },
  },
};

