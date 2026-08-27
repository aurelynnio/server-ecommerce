/**
 * OpenAPI 3.0 Paths: System Settings Management
 */

module.exports = {
  '/api/settings': {
    get: {
      tags: ['Settings'],
      summary: 'Get all platform settings (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Settings object' } },
    },
    put: {
      tags: ['Settings'],
      summary: 'Update platform settings (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                store: { type: 'object' },
                notifications: { type: 'object' },
                display: { type: 'object' },
                business: { type: 'object' },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'Settings updated' } },
    },
  },
  '/api/settings/reset': {
    post: {
      tags: ['Settings'],
      summary: 'Reset settings to system defaults (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Settings restored to defaults' } },
    },
  },
  '/api/settings/{section}': {
    get: {
      tags: ['Settings'],
      summary: 'Get specific settings section (store, notifications, display, business)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'section', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Section configuration' } },
    },
    put: {
      tags: ['Settings'],
      summary: 'Update specific settings section',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'section', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Section updated' } },
    },
  },
};

