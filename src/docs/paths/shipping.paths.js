/**
 * OpenAPI 3.0 Paths: Shop Categories & Shipping
 */

module.exports = {
  // ---------------- SHOP CATEGORIES ----------------
  '/api/shop-categories/my': {
    get: {
      tags: ['Categories'],
      summary: 'Get custom category tree for current seller shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Shop categories list' } },
    },
  },
  '/api/shop-categories': {
    post: {
      tags: ['Categories'],
      summary: 'Create custom shop category (Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' }, description: { type: 'string' } },
            },
          },
        },
      },
      responses: { 201: { description: 'Shop category created' } },
    },
  },
  '/api/shop-categories/{categoryId}': {
    put: {
      tags: ['Categories'],
      summary: 'Update shop category (Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop category updated' } },
    },
    delete: {
      tags: ['Categories'],
      summary: 'Delete shop category (Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop category deleted' } },
    },
  },
  '/api/shop-categories/{shopId}': {
    get: {
      tags: ['Categories'],
      summary: 'Get public custom categories for shop',
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Categories list for shop' } },
    },
  },

  // ---------------- SHIPPING ----------------
  '/api/shipping': {
    get: {
      tags: ['Shipping'],
      summary: 'Get shipping templates for seller shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Shipping templates' } },
    },
    post: {
      tags: ['Shipping'],
      summary: 'Create shipping template (Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'baseFee', 'estimatedDays'],
              properties: {
                name: { type: 'string', example: 'Giao Hang Nhanh' },
                baseFee: { type: 'number', example: 30000 },
                freeShippingThreshold: { type: 'number', example: 500000 },
                estimatedDays: { type: 'integer', example: 3 },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Shipping template created' } },
    },
  },
  '/api/shipping/{templateId}': {
    put: {
      tags: ['Shipping'],
      summary: 'Update shipping template',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'templateId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shipping template updated' } },
    },
    delete: {
      tags: ['Shipping'],
      summary: 'Delete shipping template',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'templateId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shipping template deleted' } },
    },
  },
};

