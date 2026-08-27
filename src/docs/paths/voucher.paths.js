/**
 * OpenAPI 3.0 Paths: Vouchers & Promotion Discounts Management
 */

module.exports = {
  '/api/vouchers/platform': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get public platform-wide vouchers',
      responses: { 200: { description: 'Platform vouchers list' } },
    },
  },
  '/api/vouchers/shop/{shopId}': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get public discount vouchers for a specific shop',
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop vouchers list' } },
    },
  },
  '/api/vouchers/available': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get available vouchers for current authenticated user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Available vouchers list' } },
    },
  },
  '/api/vouchers/apply': {
    post: {
      tags: ['Vouchers'],
      summary: 'Validate and calculate discount for voucher code',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'orderAmount'],
              properties: { code: { type: 'string', example: 'SALE20' }, orderAmount: { type: 'number', example: 500000 } },
            },
          },
        },
      },
      responses: { 200: { description: 'Calculated discount value' } },
    },
  },
  '/api/vouchers': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get all vouchers (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Admin vouchers list' } },
    },
    post: {
      tags: ['Vouchers'],
      summary: 'Create voucher (Seller or Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Voucher' },
          },
        },
      },
      responses: { 201: { description: 'Voucher created' } },
    },
  },
  '/api/vouchers/statistics': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get voucher usage analytics (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Voucher statistics' } },
    },
  },
  '/api/vouchers/{id}': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get voucher details by ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Voucher details' } },
    },
    put: {
      tags: ['Vouchers'],
      summary: 'Update voucher (Seller / Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Voucher updated' } },
    },
    delete: {
      tags: ['Vouchers'],
      summary: 'Soft-delete voucher (Seller / Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Voucher deleted' } },
    },
  },
  '/api/vouchers/{id}/permanent': {
    delete: {
      tags: ['Vouchers'],
      summary: 'Permanently purge voucher (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Voucher purged' } },
    },
  },
};

