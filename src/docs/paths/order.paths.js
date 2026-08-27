/**
 * OpenAPI 3.0 Paths: Shopping Cart & Order Lifecycle Management
 */

module.exports = {
  // ---------------- CART ----------------
  '/api/cart': {
    get: {
      tags: ['Cart'],
      summary: 'Get current user shopping cart',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: { description: 'Cart contents with pricing and active items' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/cart/items': {
    post: {
      tags: ['Cart'],
      summary: 'Add item / variant to cart',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CartItem' },
          },
        },
      },
      responses: {
        200: { description: 'Item added to cart successfully' },
        400: { description: 'Insufficient stock or invalid variant' },
      },
    },
  },
  '/api/cart/items/{itemId}': {
    put: {
      tags: ['Cart'],
      summary: 'Update item quantity in cart',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['quantity'],
              properties: { quantity: { type: 'integer', minimum: 1, example: 3 } },
            },
          },
        },
      },
      responses: { 200: { description: 'Cart item quantity updated' } },
    },
    delete: {
      tags: ['Cart'],
      summary: 'Remove specific item from cart',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Item removed from cart' } },
    },
  },
  '/api/cart/clear': {
    delete: {
      tags: ['Cart'],
      summary: 'Clear all items from shopping cart',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Cart cleared' } },
    },
  },

  // ---------------- ORDERS ----------------
  '/api/orders': {
    get: {
      tags: ['Orders'],
      summary: 'Get current user order history',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
          },
        },
      ],
      responses: { 200: { description: 'Customer orders list' } },
    },
    post: {
      tags: ['Orders'],
      summary: 'Checkout and create new order',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateOrderRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Order placed successfully',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
        },
      },
    },
  },
  '/api/orders/{orderId}': {
    get: {
      tags: ['Orders'],
      summary: 'Get order details by ID',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Order details with tracking info',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
        },
      },
    },
  },
  '/api/orders/{orderId}/cancel': {
    delete: {
      tags: ['Orders'],
      summary: 'Cancel a pending order',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Order cancelled successfully' } },
    },
  },
  '/api/orders/{orderId}/confirm-delivery': {
    post: {
      tags: ['Orders'],
      summary: 'Customer confirms order delivered',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Order delivery confirmed' } },
    },
  },
  '/api/orders/all/list': {
    get: {
      tags: ['Orders'],
      summary: 'Get all platform orders (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'All orders across platform' } },
    },
  },
  '/api/orders/seller/list': {
    get: {
      tags: ['Orders'],
      summary: 'Get orders belonging to seller shop',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Seller orders list' } },
    },
  },
  '/api/orders/seller/statistics': {
    get: {
      tags: ['Orders'],
      summary: 'Get order fulfillment statistics for seller',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: { 200: { description: 'Seller order stats' } },
    },
  },
  '/api/orders/{orderId}/status': {
    put: {
      tags: ['Orders'],
      summary: 'Update order fulfillment status (Admin/Seller)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
                },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'Order status updated' } },
    },
  },
};
