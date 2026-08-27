/**
 * OpenAPI 3.0 Paths: Flash Sale Campaigns
 */

module.exports = {
  '/api/flash-sale': {
    get: {
      tags: ['Flash Sale'],
      summary: 'Get active flash sale products',
      responses: { 200: { description: 'Active flash sale products' } },
    },
  },
  '/api/flash-sale/schedule': {
    get: {
      tags: ['Flash Sale'],
      summary: 'Get flash sale schedule timeline',
      responses: { 200: { description: 'Upcoming flash sale slots' } },
    },
  },
  '/api/flash-sale/slot/{timeSlot}': {
    get: {
      tags: ['Flash Sale'],
      summary: 'Get flash sale items by time slot',
      parameters: [{ name: 'timeSlot', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Slot products' } },
    },
  },
  '/api/flash-sale/stats': {
    get: {
      tags: ['Flash Sale'],
      summary: 'Get flash sale performance analytics (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Flash sale statistics' } },
    },
  },
  '/api/flash-sale/{productId}': {
    post: {
      tags: ['Flash Sale'],
      summary: 'Add product to flash sale (Admin / Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['discountPercentage', 'stockForSale', 'startTime', 'endTime'],
              properties: {
                discountPercentage: { type: 'number', example: 40 },
                stockForSale: { type: 'integer', example: 50 },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Product added to flash sale' } },
    },
    delete: {
      tags: ['Flash Sale'],
      summary: 'Remove product from flash sale (Admin / Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product removed from flash sale' } },
    },
  },
};

