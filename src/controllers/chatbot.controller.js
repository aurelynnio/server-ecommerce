const catchAsync = require('../configs/catchAsync');
const chatbotService = require('../services/chatbot.service');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { resolveChatSession } = require('../utils/chatSession');
const { isShuttingDown } = require('../utils/gracefulShutdown');
const metrics = require('../monitoring/chatbot.metrics');

// Feature flag: cho phép tắt chatbot hoàn toàn (kill switch / canary rollout).
const CHATBOT_ENABLED = String(process.env.CHATBOT_ENABLED || 'true').toLowerCase() !== 'false';
const DISABLED_CODE = 'CHATBOT_DISABLED';

const ChatbotController = {
  /**
   * Send message (non-streaming fallback)
   */
  sendMessage: catchAsync(async (req, res) => {
    const { message, sessionId } = req.body;

    if (!CHATBOT_ENABLED) {
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'fail',
        code: DISABLED_CODE,
        message: 'Chatbot hiện đang tạm tắt. Vui lòng thử lại sau.',
      });
    }

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
   * Stream message (SSE)
   */
  streamMessage: catchAsync(async (req, res) => {
    const { message, sessionId } = req.body;

    if (!CHATBOT_ENABLED) {
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        status: 'fail',
        code: DISABLED_CODE,
        message: 'Chatbot hiện đang tạm tắt. Vui lòng thử lại sau.',
      });
    }

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

    // SSE headers
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
      // Agent mode (tool-calling thật) hoặc RAG chain
      if (chatbotService.isAgentMode()) {
        const agent = chatbotService.getAgent();
        for await (const event of agent.stream(chatSessionId, message.trim())) {
          if (aborted || res.writableEnded) break;
          if (event.type === 'token') {
            res.write(`data: ${JSON.stringify({ type: 'token', content: event.content })}\n\n`);
          } else if (event.type === 'tool_call') {
            logger.info('[Chatbot] Agent tool call', { name: event.name });
            res.write(`data: ${JSON.stringify({ type: 'tool', name: event.name })}\n\n`);
          }
        }
        if (!aborted) {
          const messageId = await chatbotService.getLatestAssistantMessageId(chatSessionId);
          res.write(`data: ${JSON.stringify({ type: 'done', success: true, messageId })}\n\n`);
        }
        res.end();
        metrics.chatbotRequestsTotal.inc({ endpoint: 'stream', status: 'success' });
        return;
      }

      // RAG chain
      const response = await chatbotService.chatStream(chatSessionId, message.trim(), (token) => {
        if (aborted || res.writableEnded) return;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      });

      metrics.chatbotRequestsTotal.inc({
        endpoint: 'stream',
        status: response.success ? 'success' : 'error',
      });

      if (!aborted) {
        res.write(
          `data: ${JSON.stringify({ type: 'done', success: response.success, messageId: response.messageId ?? null })}\n\n`,
        );
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
   * Get chat history
   */
  getHistory: catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    resolveChatSession(req, res, sessionId);

    const result = await chatbotService.getHistory(sessionId);
    return sendSuccess(res, result, 'Chat history retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Clear session
   */
  clearSession: catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    resolveChatSession(req, res, sessionId);

    const result = await chatbotService.clearSession(sessionId);
    return sendSuccess(res, result, 'Session cleared successfully', StatusCodes.OK);
  }),

  /**
   * Get chatbot status (feature flag check cho client)
   */
  getStatus: catchAsync(async (_req, res) => {
    return sendSuccess(
      res,
      {
        enabled: CHATBOT_ENABLED,
        agentMode: chatbotService.isAgentMode?.() ?? false,
      },
      'Chatbot status',
      StatusCodes.OK,
    );
  }),

  /**
   * Get suggestions
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
   * Get all sessions (admin)
   */
  getAllSessions: catchAsync(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await chatbotService.getAllSessions(Number(page), Number(limit));
    return sendSuccess(res, result, 'Chat sessions retrieved successfully', StatusCodes.OK);
  }),

  /**
   * Save feedback (👍/👎) cho 1 message chatbot
   */
  feedback: catchAsync(async (req, res) => {
    const { sessionId, messageId, rating, comment } = req.body || {};

    if (!sessionId || !messageId || !['up', 'down'].includes(rating)) {
      return sendFail(
        res,
        'sessionId, messageId và rating (up|down) là bắt buộc',
        StatusCodes.BAD_REQUEST,
      );
    }

    if (typeof comment === 'string' && comment.length > 500) {
      return sendFail(res, 'Comment quá dài (tối đa 500 ký tự)', StatusCodes.BAD_REQUEST);
    }

    const result = await chatbotService.saveFeedback(
      sessionId,
      messageId,
      rating,
      comment,
      req.user?._id || null,
    );

    return sendSuccess(res, result, 'Feedback saved', StatusCodes.OK);
  }),

  /**
   * Admin: xoá toàn bộ message của 1 session (GDPR / cleanup)
   */
  adminDeleteSession: catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    const result = await chatbotService.adminDeleteSession(sessionId, req.user?._id);
    return sendSuccess(res, result, 'Session deleted by admin', StatusCodes.OK);
  }),
};

module.exports = ChatbotController;