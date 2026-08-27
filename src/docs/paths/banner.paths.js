/**
 * OpenAPI 3.0 Paths: Banners Management
 */

module.exports = {
  '/api/banners': {
    get: {
      tags: ['Banners'],
      summary: 'Get active promotional banners',
      responses: { 200: { description: 'Active banners list' } },
    },
    post: {
      tags: ['Banners'],
      summary: 'Create promotional banner (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['title', 'image'],
              properties: {
                title: { type: 'string' },
                link: { type: 'string' },
                position: { type: 'string', enum: ['home_top', 'home_middle', 'sidebar'] },
                image: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Banner created' } },
    },
  },
  '/api/banners/admin/all': {
    get: {
      tags: ['Banners'],
      summary: 'Get all banners including inactive (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Admin banners list' } },
    },
  },
  '/api/banners/{id}': {
    get: {
      tags: ['Banners'],
      summary: 'Get banner by ID',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Banner details' } },
    },
    put: {
      tags: ['Banners'],
      summary: 'Update banner (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Banner updated' } },
    },
    delete: {
      tags: ['Banners'],
      summary: 'Delete banner (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Banner deleted' } },
    },
  },
};

