/**
 * OpenAPI 3.0 Paths: Real-Time Chat System
 */

module.exports = {
  '/api/chat/start': {
    post: {
      tags: ['Chat'],
      summary: 'Start or find existing 1-on-1 conversation with participant',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['participantId'],
              properties: {
                participantId: { type: 'string', example: '65df8a76b91234567890abc2' },
                type: { type: 'string', enum: ['direct', 'support', 'shop'] },
              },
            },
          },
        },
      },
      responses: { 200: { description: 'Conversation session object' } },
    },
  },
  '/api/chat/message': {
    post: {
      tags: ['Chat'],
      summary: 'Send text message in conversation',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['conversationId', 'content'],
              properties: {
                conversationId: { type: 'string', example: '65df8a76b91234567890abcd' },
                content: { type: 'string', example: 'Shop co san mau den size L khong?' },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Message sent' } },
    },
  },
  '/api/chat/message/media': {
    post: {
      tags: ['Chat'],
      summary: 'Send media or attachment files in chat',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['conversationId', 'files'],
              properties: {
                conversationId: { type: 'string' },
                content: { type: 'string' },
                files: { type: 'array', items: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Media messages dispatched' } },
    },
  },
  '/api/chat/conversations': {
    get: {
      tags: ['Chat'],
      summary: 'Get all conversations for current user',
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
  '/api/chat/conversations/{conversationId}/read': {
    put: {
      tags: ['Chat'],
      summary: 'Mark all messages in conversation as read',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'conversationId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Marked as read' } },
    },
  },
};

