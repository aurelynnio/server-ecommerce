/**
 * OpenAPI 3.0 Paths: Role-Based Access Control & Permissions
 */

module.exports = {
  '/api/permissions': {
    get: {
      tags: ['Permissions'],
      summary: 'Get all available system permissions',
      responses: { 200: { description: 'Permissions list' } },
    },
  },
  '/api/permissions/roles': {
    get: {
      tags: ['Permissions'],
      summary: 'Get default permission matrix per role',
      responses: { 200: { description: 'Role permission mappings' } },
    },
  },
  '/api/permissions/me': {
    get: {
      tags: ['Permissions'],
      summary: 'Get effective permissions of current user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'User effective permissions' } },
    },
  },
  '/api/permissions/audit': {
    get: {
      tags: ['Permissions'],
      summary: 'Get permission audit logs (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'userId', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'Audit logs list' } },
    },
  },
  '/api/permissions/user/{userId}': {
    get: {
      tags: ['Permissions'],
      summary: 'Get user permission overrides (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'User permissions' } },
    },
    put: {
      tags: ['Permissions'],
      summary: 'Update user permissions (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['permissions'],
              properties: { permissions: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
      responses: { 200: { description: 'Permissions updated' } },
    },
  },
  '/api/permissions/user/{userId}/grant': {
    post: {
      tags: ['Permissions'],
      summary: 'Grant a single permission to user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['permission'],
              properties: { permission: { type: 'string' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Permission granted' } },
    },
  },
  '/api/permissions/user/{userId}/revoke': {
    post: {
      tags: ['Permissions'],
      summary: 'Revoke a single permission from user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['permission'],
              properties: { permission: { type: 'string' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Permission revoked' } },
    },
  },
};

