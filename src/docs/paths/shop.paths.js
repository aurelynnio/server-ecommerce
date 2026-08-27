/**
 * OpenAPI 3.0 Paths: Multi-Vendor Shops Management
 */

module.exports = {
  '/api/shops': {
    get: {
      tags: ['Shops'],
      summary: 'Get all public active shops',
      responses: { 200: { description: 'Public shops list' } },
    },
    put: {
      tags: ['Shops'],
      summary: 'Update current seller shop info',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Shop info updated' } },
    },
  },
  '/api/shops/admin/all': {
    get: {
      tags: ['Shops'],
      summary: 'Get all shops with status filtering (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'All shops list' } },
    },
  },
  '/api/shops/admin/{shopId}/status': {
    put: {
      tags: ['Shops'],
      summary: 'Update shop verification status (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: { status: { type: 'string', enum: ['active', 'inactive', 'suspended', 'rejected'] } },
            },
          },
        },
      },
      responses: { 200: { description: 'Shop status updated' } },
    },
  },
  '/api/shops/register': {
    post: {
      tags: ['Shops'],
      summary: 'Register a new vendor shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'description'],
              properties: {
                name: { type: 'string', example: 'Shop Thoi Trang Nam Pro' },
                description: { type: 'string' },
                address: { type: 'string' },
                phoneNumber: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Shop registered' } },
    },
  },
  '/api/shops/upload-register-image': {
    post: {
      tags: ['Shops'],
      summary: 'Upload logo or banner for shop registration',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Image uploaded' } },
    },
  },
  '/api/shops/statistics': {
    get: {
      tags: ['Shops'],
      summary: 'Get seller shop analytics & statistics',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Shop statistics' } },
    },
  },
  '/api/shops/following': {
    get: {
      tags: ['Shops'],
      summary: 'Get shops followed by current user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Followed shops list' } },
    },
  },
  '/api/shops/me': {
    get: {
      tags: ['Shops'],
      summary: 'Get current user shop profile',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'My shop profile' } },
    },
  },
  '/api/shops/upload-image': {
    post: {
      tags: ['Shops'],
      summary: 'Upload shop logo or banner',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Image uploaded' } },
    },
  },
  '/api/shops/upload-logo': {
    post: {
      tags: ['Shops'],
      summary: 'Upload shop logo',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Logo uploaded' } },
    },
  },
  '/api/shops/upload-banner': {
    post: {
      tags: ['Shops'],
      summary: 'Upload shop banner',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Banner uploaded' } },
    },
  },
  '/api/shops/{shopId}/follow': {
    post: {
      tags: ['Shops'],
      summary: 'Follow a shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop followed' } },
    },
    delete: {
      tags: ['Shops'],
      summary: 'Unfollow a shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop unfollowed' } },
    },
  },
  '/api/shops/slug/{slug}': {
    get: {
      tags: ['Shops'],
      summary: 'Get public shop profile by slug',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop public profile' } },
    },
  },
  '/api/shops/{shopId}': {
    get: {
      tags: ['Shops'],
      summary: 'Get public shop profile by ID',
      parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Shop info' } },
    },
  },
};

