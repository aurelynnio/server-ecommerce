/**
 * OpenAPI 3.0 Paths: VNPay Gateway Payment Management
 */

module.exports = {
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
      responses: { 200: { description: 'Payment redirect processed' } },
    },
  },
  '/api/payment/vnpay-ipn': {
    get: {
      tags: ['Payment'],
      summary: 'VNPay server IPN verification callback',
      responses: { 200: { description: 'IPN verified and order updated' } },
    },
  },
};

