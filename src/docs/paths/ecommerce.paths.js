/**
 * OpenAPI 3.0 Paths: Payment, Categories, Shops, Vouchers, Reviews,
 * Search, Flash Sale, Permissions, Chat, and Health Probes.
 */

module.exports = {
  // ---------------- PAYMENT ----------------
  '/api/payment': {
    post: {
      tags: ['Payment'],
      summary: 'Initiate VNPay payment URL for an order',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreatePaymentRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Payment URL generated',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { paymentUrl: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
  '/api/payment/order/{orderId}': {
    get: {
      tags: ['Payment'],
      summary: 'Get payment status by order ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Payment transaction status' } },
    },
  },
  '/api/payment/vnpay-return': {
    get: {
      tags: ['Payment'],
      summary: 'VNPay client redirect return handler',
      responses: { 200: { description: 'Payment redirect handled' } },
    },
  },
  '/api/payment/vnpay-ipn': {
    get: {
      tags: ['Payment'],
      summary: 'VNPay server IPN verification callback',
      responses: { 200: { description: 'IPN processed' } },
    },
  },

  // ---------------- CATEGORIES & BANNERS ----------------
  '/api/categories': {
    get: {
      tags: ['Categories'],
      summary: 'Get full product categories tree',
      responses: { 200: { description: 'Categories list' } },
    },
    post: {
      tags: ['Categories'],
      summary: 'Create category (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 201: { description: 'Category created' } },
    },
  },
  '/api/banners': {
    get: {
      tags: ['Banners'],
      summary: 'Get active promotional hero banners',
      responses: { 200: { description: 'Banners list' } },
    },
    post: {
      tags: ['Banners'],
      summary: 'Create banner (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 201: { description: 'Banner created' } },
    },
  },

  // ---------------- SHOPS & SHIPPING ----------------
  '/api/shops/register': {
    post: {
      tags: ['Shops'],
      summary: 'Register new vendor shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 201: { description: 'Shop registered successfully' } },
    },
  },
  '/api/shops/profile': {
    get: {
      tags: ['Shops'],
      summary: 'Get seller shop profile',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Shop profile' } },
    },
    put: {
      tags: ['Shops'],
      summary: 'Update seller shop profile',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Shop profile updated' } },
    },
  },
  '/api/shipping': {
    get: {
      tags: ['Shipping'],
      summary: 'Get available shipping methods & carriers',
      responses: { 200: { description: 'Shipping methods' } },
    },
  },

  // ---------------- VOUCHERS & DISCOUNTS ----------------
  '/api/vouchers': {
    get: {
      tags: ['Vouchers'],
      summary: 'Get active public vouchers',
      responses: {
        200: {
          description: 'Vouchers list',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Voucher' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Vouchers'],
      summary: 'Create discount voucher (Seller/Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 201: { description: 'Voucher created' } },
    },
  },
  '/api/vouchers/apply': {
    post: {
      tags: ['Vouchers'],
      summary: 'Check voucher validity and calculate discount',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'orderAmount'],
              properties: { code: { type: 'string' }, orderAmount: { type: 'number' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Discount calculation details' } },
    },
  },

  // ---------------- REVIEWS & WISHLIST ----------------
  '/api/reviews/product/{productId}': {
    get: {
      tags: ['Reviews'],
      summary: 'Get reviews for product',
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product reviews list' } },
    },
  },
  '/api/reviews': {
    post: {
      tags: ['Reviews'],
      summary: 'Submit product review (Authenticated customer)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 201: { description: 'Review posted' } },
    },
  },
  '/api/wishlist': {
    get: {
      tags: ['Wishlist'],
      summary: 'Get user saved wishlist items',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Wishlist items' } },
    },
  },
  '/api/wishlist/{productId}': {
    post: {
      tags: ['Wishlist'],
      summary: 'Add product to wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product added to wishlist' } },
    },
    delete: {
      tags: ['Wishlist'],
      summary: 'Remove product from wishlist',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product removed from wishlist' } },
    },
  },

  // ---------------- NOTIFICATIONS & NEWSLETTER ----------------
  '/api/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'Get current user notifications',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Notifications list' } },
    },
  },
  '/api/notifications/read-all': {
    put: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'All notifications marked read' } },
    },
  },
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
              properties: { email: { type: 'string', format: 'email' } },
            },
          },
        },
      },
      responses: { 200: { description: 'Subscribed successfully' } },
    },
  },

  // ---------------- SEARCH, RECOMMENDATIONS & FLASH SALE ----------------
  '/api/search': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Global search across products and categories',
      parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Search results' } },
    },
  },
  '/api/recommendations': {
    get: {
      tags: ['Search & Discovery'],
      summary: 'Get personalized product recommendations for user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Personalized recommendations' } },
    },
  },
  '/api/flash-sale/active': {
    get: {
      tags: ['Flash Sale'],
      summary: 'Get active flash sale session items',
      responses: { 200: { description: 'Current flash sale campaign' } },
    },
  },

  // ---------------- STATISTICS, SETTINGS & PERMISSIONS ----------------
  '/api/statistics/dashboard': {
    get: {
      tags: ['Statistics'],
      summary: 'Get admin dashboard business metrics',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Revenue, orders, user growth stats' } },
    },
  },
  '/api/settings': {
    get: {
      tags: ['Settings'],
      summary: 'Get public platform settings',
      responses: { 200: { description: 'Platform settings' } },
    },
  },
  '/api/permissions': {
    get: {
      tags: ['Permissions'],
      summary: 'Get RBAC permission matrix (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Permission matrix' } },
    },
  },

  // ---------------- REALTIME CHAT ----------------
  '/api/chat/conversations': {
    get: {
      tags: ['Chat'],
      summary: 'Get user chat conversations list',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Conversations list' } },
    },
  },
  '/api/chat/messages/{conversationId}': {
    get: {
      tags: ['Chat'],
      summary: 'Get message history for conversation',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'conversationId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Messages list' } },
    },
  },

  // ---------------- MONITORING & HEALTH ----------------
  '/health/live': {
    get: {
      tags: ['Monitoring & Health'],
      summary: 'Kubernetes / Container Liveness Probe',
      description: 'Returns 200 OK if the Node.js event loop and process are alive.',
      responses: {
        200: {
          description: 'Server process is alive',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LivenessResponse' } } },
        },
      },
    },
  },
  '/health/ready': {
    get: {
      tags: ['Monitoring & Health'],
      summary: 'Kubernetes / Load Balancer Readiness Probe',
      description: 'Verifies MongoDB, Redis, and RabbitMQ connectivity. Cached in RAM for 10 seconds to prevent DB hammering.',
      responses: {
        200: {
          description: 'All services ready',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessResponse' } } },
        },
        503: { description: 'Service unavailable: vital dependency down' },
      },
    },
  },
  '/metrics': {
    get: {
      tags: ['Monitoring & Health'],
      summary: 'Prometheus metrics scrape endpoint',
      description: 'Exports RED metrics (rate, error, duration), memory, event loop lag, and multi-worker aggregated metrics.',
      security: [{ metricsAuth: [] }],
      responses: {
        200: {
          description: 'Prometheus metrics formatted text',
          content: { 'text/plain; version=0.0.4': {} },
        },
        403: { description: 'Forbidden if metrics token/IP unauthorized in production' },
      },
    },
  },
};
