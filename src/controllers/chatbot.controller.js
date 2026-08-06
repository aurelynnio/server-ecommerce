const catchAsync = require('../configs/catchAsync');
const chatbotService = require('../services/chatbot.service');
const mongoose = require('mongoose');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { resolveChatSession } = require('../utils/chatSession');
const metrics = require('../monitoring/chatbot.metrics');

// Theo dõi trạng thái shutdown để tránh nhận request LLM mới khi đang tắt.
let isShuttingDown = false;
const SHUTDOWN_GRACE_MS = 15_000;
process.once('SIGTERM', () => {
  logger.warn('[Chatbot] SIGTERM received, marking shutting down');
  isShuttingDown = true;
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
});
process.once('SIGINT', () => {
  logger.warn('[Chatbot] SIGINT received, marking shutting down');
  isShuttingDown = true;
  setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
});

const PRIORITY_TEXT_KEYS = ['content', 'text'];

const extractTextValue = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextValue(item))
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  if (value && typeof value === 'object') {
    for (const key of PRIORITY_TEXT_KEYS) {
      const candidate = extractTextValue(value[key]);
      if (candidate) return candidate;
    }

    const nestedObjects = Object.values(value).filter(
      (item) => item && (Array.isArray(item) || typeof item === 'object'),
    );

    for (const item of nestedObjects) {
      const candidate = extractTextValue(item);
      if (candidate) return candidate;
    }
  }

  return '';
};

const extractMessageContent = (payload) => {
  const prioritizedSources = [
    payload?.data,
    payload?.message,
    payload?.lc_kwargs,
    payload,
  ];

  for (const source of prioritizedSources) {
    const extracted = extractTextValue(source);
    if (extracted) return extracted;
  }

  return '[Không đọc được nội dung tin nhắn]';
};

const normalizeRole = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();

  if (normalized === 'human' || normalized === 'user') return 'user';
  if (normalized === 'ai' || normalized === 'assistant') return 'assistant';

  return null;
};

const normalizeTimestamp = (value, fallbackTimestamp) => {
  if (value instanceof Date) return value;

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return fallbackTimestamp;
};

const extractConversationMessages = (payload, fallbackTimestamp = new Date()) => {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractConversationMessages(item, fallbackTimestamp));
  }

  if (typeof payload !== 'object') return [];

  const detectedRole =
    normalizeRole(payload.role) ||
    normalizeRole(payload.type) ||
    normalizeRole(payload?.data?.role) ||
    normalizeRole(payload?.data?.type);

  if (detectedRole) {
    return [
      {
        role: detectedRole,
        content: extractMessageContent(payload),
        timestamp: normalizeTimestamp(
          payload.timestamp || payload.createdAt || payload.updatedAt,
          fallbackTimestamp,
        ),
      },
    ];
  }

  const nestedSources = [
    payload.messages,
    payload.history,
    payload.items,
    payload.entries,
    payload.data,
    payload.message,
    payload.lc_kwargs,
  ].filter(Boolean);

  for (const source of nestedSources) {
    const nestedMessages = extractConversationMessages(source, fallbackTimestamp);
    if (nestedMessages.length > 0) return nestedMessages;
  }

  return [];
};

const ChatbotController = {
  /**
   * Send message
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  sendMessage: catchAsync(async (req, res) => {
    const { message, sessionId } = req.body;
    const _userId = req.user?._id || null;

    if (!message || !message.trim()) {
      return sendFail(res, 'Message is required', StatusCodes.BAD_REQUEST);
    }

    const chatSessionId = resolveChatSession(req, res, sessionId);

    const response = await chatbotService.chat(chatSessionId, message.trim());
    metrics.chatbotRequestsTotal.inc({
      endpoint: 'message',
      status: response.success ? 'success' : 'error',
    });

    return sendSuccess(
      res,
      { ...response, sessionId: chatSessionId },
      response.success ? 'Message sent successfully' : 'Failed to process message',
      response.success ? StatusCodes.OK : StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }),

  /**
   * Stream message
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  streamMessage: catchAsync(async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return sendFail(res, 'Message is required', StatusCodes.BAD_REQUEST);
    }

    if (isShuttingDown) {
      return sendFail(
        res,
        'Server đang bảo trì, vui lòng thử lại sau ít phút',
        StatusCodes.SERVICE_UNAVAILABLE,
      );
    }

    const chatSessionId = resolveChatSession(req, res, sessionId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'session', sessionId: chatSessionId })}\n\n`);

    let aborted = false;
    req.on('close', () => {
      aborted = true;
      logger.info('[Chatbot] Client disconnected before stream completed', {
        sessionId: chatSessionId,
      });
    });

    try {
      const response = await chatbotService.chatStream(chatSessionId, message.trim(), (token) => {
        if (aborted || res.writableEnded) return;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      });
      metrics.chatbotRequestsTotal.inc({
        endpoint: 'stream',
        status: response.success ? 'success' : 'error',
      });

      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: 'done', success: response.success })}\n\n`);
      }
      res.end();
    } catch (error) {
      logger.error('[Chatbot] Stream error:', { error });
      metrics.chatbotErrorsTotal.inc({ stage: 'stream_controller' });
      metrics.chatbotRequestsTotal.inc({ endpoint: 'stream', status: 'error' });
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Có lỗi xảy ra' })}\n\n`);
      }
      res.end();
    }
  }),

  /**
   * Get history
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getHistory: catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    resolveChatSession(req, res, sessionId);

    const collection = mongoose.connection.collection('chatbot_messages');
    const messages = await collection.find({ sessionId }).sort({ _id: 1 }).toArray();

    const formattedMessages = messages.flatMap((msg) =>
      extractConversationMessages(msg, msg._id.getTimestamp()),
    );

    return sendSuccess(
      res,
      { sessionId, messages: formattedMessages },
      'Chat history retrieved successfully',
      StatusCodes.OK,
    );
  }),

  /**
   * Clear session
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  clearSession: catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    resolveChatSession(req, res, sessionId);

    const collection = mongoose.connection.collection('chatbot_messages');
    await collection.deleteMany({ sessionId });

    return sendSuccess(res, null, 'Session cleared successfully', StatusCodes.OK);
  }),

  /**
   * Get suggestions
   * @param {any} _req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSuggestions: catchAsync(async (_req, res) => {
    const suggestions = [
      'Tôi muốn tìm áo thun nam',
      'Có sản phẩm nào đang giảm giá không?',
      'Gợi ý cho tôi sản phẩm hot nhất',
      'Tôi cần tư vấn chọn size',
      'Có freeship không?',
    ];

    return sendSuccess(res, { suggestions }, 'Suggestions retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Get all sessions
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getAllSessions: catchAsync(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const collection = mongoose.connection.collection('chatbot_messages');

    const sessions = await collection
      .aggregate([
        {
          $sort: { _id: 1 },
        },
        {
          $group: {
            _id: '$sessionId',
            lastMessageAt: { $max: '$_id' },
            docs: { $push: '$$ROOT' },
          },
        },
        {
          $sort: { lastMessageAt: -1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: parseInt(limit) }],
          },
        },
      ])
      .toArray();

    const result = sessions[0];
    const total = result.metadata[0]?.total || 0;
    const sessionData = result.data.map((s) => {
      const flattenedMessages = s.docs.flatMap((doc) =>
        extractConversationMessages(doc, doc._id.getTimestamp()),
      );
      const firstMessage = flattenedMessages[0] || null;
      const lastMessage = flattenedMessages[flattenedMessages.length - 1] || null;

      return {
        sessionId: s._id,
        lastMessage: lastMessage?.content || '[Không đọc được nội dung tin nhắn]',
        messageCount: flattenedMessages.length,
        createdAt: (firstMessage?.timestamp || s.lastMessageAt.getTimestamp()).toISOString(),
        updatedAt: (lastMessage?.timestamp || s.lastMessageAt.getTimestamp()).toISOString(),
      };
    });

    return sendSuccess(
      res,
      {
        data: sessionData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Chat sessions retrieved successfully',
      StatusCodes.OK,
    );
  }),

  /**
   * Admin: xoá toàn bộ message của 1 session (GDPR / cleanup)
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  adminDeleteSession: catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    const collection = mongoose.connection.collection('chatbot_messages');
    const result = await collection.deleteMany({ sessionId });

    logger.warn('[Chatbot] Admin deleted session', {
      sessionId,
      deletedCount: result.deletedCount,
      actorId: req.user?._id,
    });

    return sendSuccess(
      res,
      { sessionId, deletedCount: result.deletedCount },
      'Session deleted by admin',
      StatusCodes.OK,
    );
  }),
};

module.exports = ChatbotController;
