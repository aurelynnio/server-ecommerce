/**
 * OpenAPI 3.0 Paths: Categories Management
 */

module.exports = {
  '/api/categories/active': {
    get: {
      tags: ['Categories'],
      summary: 'Get all active published categories',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { 200: { description: 'Active categories list' } },
    },
  },
  '/api/categories/tree': {
    get: {
      tags: ['Categories'],
      summary: 'Get hierarchical category tree with nested children',
      responses: { 200: { description: 'Category tree hierarchy' } },
    },
  },
  '/api/categories/slug/{slug}': {
    get: {
      tags: ['Categories'],
      summary: 'Get category details by slug',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Category details' } },
    },
  },
  '/api/categories': {
    get: {
      tags: ['Categories'],
      summary: 'Get all categories with filters (Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'All categories' } },
    },
    post: {
      tags: ['Categories'],
      summary: 'Create new category (Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', example: 'Thời Trang Nam' },
                description: { type: 'string' },
                parent: { type: 'string', example: '65df8a76b91234567890abc1' },
                image: { type: 'string' },
                order: { type: 'integer', example: 0 },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Category created' } },
    },
  },
  '/api/categories/statistics': {
    get: {
      tags: ['Categories'],
      summary: 'Get category statistics (Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Category product counts and stats' } },
    },
  },
  '/api/categories/{categoryId}': {
    get: {
      tags: ['Categories'],
      summary: 'Get category by ID (Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Category details' } },
    },
    put: {
      tags: ['Categories'],
      summary: 'Update category (Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                parent: { type: 'string' },
                image: { type: 'string' },
                order: { type: 'integer' },
                isActive: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'Category updated' } },
    },
    delete: {
      tags: ['Categories'],
      summary: 'Delete category (Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Category deleted' } },
    },
  },
  '/api/categories/{categoryId}/subcategories': {
    get: {
      tags: ['Categories'],
      summary: 'Get category with all direct subcategories',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Category and subcategories' } },
    },
  },
};

