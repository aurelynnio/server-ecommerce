/**
 * OpenAPI 3.0 Paths: Notifications & Newsletter Management
 */

module.exports = {
  // ---------------- NOTIFICATIONS ----------------
  '/api/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'Get paginated notifications for current user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { 200: { description: 'Notifications list' } },
    },
    post: {
      tags: ['Notifications'],
      summary: 'Send broadcast notification (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'message'],
              properties: {
                title: { type: 'string' },
                message: { type: 'string' },
                type: { type: 'string', enum: ['order', 'system', 'promotion'] },
                link: { type: 'string' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Notification created' } },
    },
    delete: {
      tags: ['Notifications'],
      summary: 'Clear all notifications for user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Notifications cleared' } },
    },
  },
  '/api/notifications/read-all': {
    patch: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'All notifications marked read' } },
    },
  },
  '/api/notifications/count': {
    get: {
      tags: ['Notifications'],
      summary: 'Get unread notification count',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Unread count' } },
    },
  },
  '/api/notifications/{id}': {
    get: {
      tags: ['Notifications'],
      summary: 'Get notification by ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Notification details' } },
    },
    patch: {
      tags: ['Notifications'],
      summary: 'Update notification read status',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { isRead: { type: 'boolean' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Notification updated' } },
    },
  },

  // ---------------- NEWSLETTER ----------------
  '/api/newsletter/subscribe': {
    post: {
      tags: ['Newsletter'],
      summary: 'Subscribe email to promotional newsletter',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email', example: 'user@example.com' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Subscribed to newsletter successfully' } },
    },
  },
};

