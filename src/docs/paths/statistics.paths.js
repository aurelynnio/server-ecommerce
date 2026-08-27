/**
 * OpenAPI 3.0 Paths: Admin Statistics & Analytics
 */

module.exports = {
  '/api/statistics/dashboard': {
    get: {
      tags: ['Statistics'],
      summary: 'Get dashboard overview statistics (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: {
          description: 'Platform metrics (total revenue, active users, orders, product counts)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  revenue: { type: 'number' },
                  totalOrders: { type: 'integer' },
                  totalUsers: { type: 'integer' },
                  totalProducts: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
};

