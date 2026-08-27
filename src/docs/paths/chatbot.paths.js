/**
 * OpenAPI 3.0 Paths: AI Shopping Assistant & Chatbot
 */

module.exports = {
  '/api/chatbot/message': {
    post: {
      tags: ['Chatbot'],
      summary: 'Send message to AI Shopping Assistant (JSON response)',
      description: 'Executes RAG / Agent tool-calling chain to answer user product queries, recommendations, or order inquiries.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChatMessageRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'AI assistant response payload',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
        503: { description: 'Chatbot service disabled or under maintenance' },
      },
    },
  },
  '/api/chatbot/stream': {
    post: {
      tags: ['Chatbot'],
      summary: 'Stream AI assistant response via Server-Sent Events (SSE)',
      description: 'Streams tokens as generated in real time, emits tool invocation events, and provides message ID on completion.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChatMessageRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Server-Sent Events stream of JSON chunks (`data: {"type":"token"|"tool"|"done", "content":"..."}`)',
          content: { 'text/event-stream': {} },
        },
      },
    },
  },
  '/api/chatbot/history/{sessionId}': {
    get: {
      tags: ['Chatbot'],
      summary: 'Get conversation history for session',
      parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Conversation messages history list' } },
    },
  },
  '/api/chatbot/session/{sessionId}': {
    delete: {
      tags: ['Chatbot'],
      summary: 'Clear chatbot session history',
      parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Session conversation cleared' } },
    },
  },
  '/api/chatbot/suggestions': {
    get: {
      tags: ['Chatbot'],
      summary: 'Get quick question suggestion prompts',
      responses: { 200: { description: 'Suggested questions' } },
    },
  },
  '/api/chatbot/status': {
    get: {
      tags: ['Chatbot'],
      summary: 'Check AI chatbot availability and agent mode status',
      responses: { 200: { description: 'Status payload' } },
    },
  },
  '/api/chatbot/feedback': {
    post: {
      tags: ['Chatbot'],
      summary: 'Submit user feedback rating (👍 / 👎) for AI response',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChatFeedbackRequest' },
          },
        },
      },
      responses: { 200: { description: 'Feedback recorded successfully' } },
    },
  },
  '/api/chatbot/admin/sessions': {
    get: {
      tags: ['Chatbot'],
      summary: 'List all conversation sessions (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      ],
      responses: { 200: { description: 'Admin sessions list' } },
    },
  },
};

