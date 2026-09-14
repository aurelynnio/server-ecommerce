const catchAsync = require('../configs/catchAsync');
const chatbotService = require('../services/chatbot.service');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const { resolveChatSession } = require('../chatbot/chatSession');
const { isShuttingDown } = require('../chatbot/gracefulShutdown');
const metrics = require('../monitoring/chatbot.metrics');
const redisClient = require('../configs/redis.config');

// Feature flag: cho phép tắt chatbot hoàn toàn (kill switch / canary rollout).
const CHATBOT_ENABLED = String(process.env.CHATBOT_ENABLED || 'true').toLowerCase() !== 'false';
const DISABLED_CODE = 'CHATBOT_DISABLED';

// Timeout tổng cho 1 lần stream (backstop: mỗi LLM call đã có MISTRAL_TIMEOUT_MS
// riêng, nhưng agent loop nhiều iteration + tool call có thể kéo dài vô hạn).
// Client frontend timeout 45s — backstop server nên lớn hơn để client tự abort trước.
const STREAM_TIMEOUT_MS = Number(process.env.CHATBOT_STREAM_TIMEOUT_MS) || 90 * 1000;
const STREAM_TIMEOUT_MESSAGE = 'Hết thời gian chờ phản hồi. Vui lòng thử lại sau.';

// Per-session concurrency lock: chặn user gửi nhiều message cùng lúc cho cùng session.
const LOCK_TTL_SECONDS = 120;
const acquireSessionLock = async (sessionId) => {
  try {
    if (!redisClient?.isReady?.()) return true; // degrade gracefully
    const key = `chatbot:lock:${sessionId}`;
    const result = await redisClient.set(key, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn('[Chatbot] Failed to acquire session lock in Redis, degrading gracefully:', {
      error: err.message,
    });
    return true;
  }
};
const releaseSessionLock = async (sessionId) => {
  try {
    if (!redisClient?.isReady?.()) return;
    await redisClient.del(`chatbot:lock:${sessionId}`);
  } catch {
    // degrade gracefully
  }
};

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

    if (isShuttingDown) {
      return sendFail(
        res,
        'Server đang bảo trì, vui lòng thử lại sau ít phút',
        StatusCodes.SERVICE_UNAVAILABLE,
      );
    }

    const chatSessionId = resolveChatSession(req, res, sessionId);

    if (!(await acquireSessionLock(chatSessionId))) {
      return sendFail(
        res,
        'Đang xử lý tin nhắn trước đó, vui lòng đợi giây lát',
        StatusCodes.TOO_MANY_REQUESTS,
      );
    }
    try {
      // Agent mode (tool-calling) cho cả path non-stream — trước đây chỉ /stream dùng agent
      if (chatbotService.isAgentMode()) {
        const response = await chatbotService.chatAgent(chatSessionId, message.trim());
        const status = response.success ? 'success' : 'error';

        metrics.chatbotRequestsTotal.inc({
          endpoint: 'message',
          status,
        });

        if (!response.success) {
          return sendFail(
            res,
            response.message || 'Failed to process message',
            StatusCodes.INTERNAL_SERVER_ERROR,
          );
        }

        return sendSuccess(
          res,
          { ...response, sessionId: chatSessionId },
          'Message sent successfully',
          StatusCodes.OK,
        );
      }

      const response = await chatbotService.chat(chatSessionId, message.trim());
      const status = response.isCacheHit ? 'cache_hit' : response.success ? 'success' : 'error';

      metrics.chatbotRequestsTotal.inc({
        endpoint: 'message',
        status,
      });

      if (!response.success) {
        return sendFail(
          res,
          response.message || 'Failed to process message',
          StatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      return sendSuccess(
        res,
        { ...response, sessionId: chatSessionId },
        'Message sent successfully',
        StatusCodes.OK,
      );
    } finally {
      await releaseSessionLock(chatSessionId).catch(() => {});
    }
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

    if (!(await acquireSessionLock(chatSessionId))) {
      return sendFail(
        res,
        'Đang xử lý tin nhắn trước đó, vui lòng đợi giây lát',
        StatusCodes.TOO_MANY_REQUESTS,
      );
    }

    // Start end-to-end stream latency timer
    const stopTimer = metrics.chatbotLatencySeconds.startTimer({
      endpoint: 'stream',
      stream: 'true',
    });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'session', sessionId: chatSessionId })}\n\n`);

    let aborted = false;
    let timedOut = false;
    req.on('close', () => {
      if (!res.writableEnded) {
        aborted = true;
        stopTimer({ status: 'aborted' });
        metrics.chatbotRequestsTotal.inc({ endpoint: 'stream', status: 'aborted' });
        logger.info('[Chatbot] Client disconnected before stream completed', {
          sessionId: chatSessionId,
        });
      }
    });

    // Backstop timeout: đóng connection nếu stream kéo dài quá STREAM_TIMEOUT_MS
    // (LLM call có thể treo giữa các iteration; per-request timeout không cover tổng thời gian)
    const streamTimeoutTimer = setTimeout(() => {
      timedOut = true;
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: STREAM_TIMEOUT_MESSAGE })}\n\n`,
        );
        res.end();
      }
      stopTimer({ status: 'timeout' });
      metrics.chatbotRequestsTotal.inc({ endpoint: 'stream', status: 'timeout' });
      logger.warn('[Chatbot] Stream timed out', { sessionId: chatSessionId });
    }, STREAM_TIMEOUT_MS);

    try {
      // Agent mode (tool-calling thật) hoặc RAG chain
      if (chatbotService.isAgentMode()) {
        const agent = chatbotService.getAgent();
        for await (const event of agent.stream(chatSessionId, message.trim())) {
          if (aborted || timedOut || res.writableEnded) break;
          if (event.type === 'token') {
            res.write(`data: ${JSON.stringify({ type: 'token', content: event.content })}\n\n`);
          } else if (event.type === 'tool_call') {
            logger.info('[Chatbot] Agent tool call', { name: event.name });
            res.write(`data: ${JSON.stringify({ type: 'tool', name: event.name })}\n\n`);
          } else if (event.type === 'correction') {
            res.write(
              `data: ${JSON.stringify({ type: 'correction', content: event.content })}\n\n`,
            );
          }
        }
        if (!aborted && !timedOut) {
          const messageId = await chatbotService.getLatestAssistantMessageId(chatSessionId);
          res.write(`data: ${JSON.stringify({ type: 'done', success: true, messageId })}\n\n`);
          stopTimer({ status: 'success' });
          metrics.chatbotRequestsTotal.inc({ endpoint: 'stream', status: 'success' });
        }
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }

      // RAG chain
      let tokenCount = 0;
      const response = await chatbotService.chatStream(chatSessionId, message.trim(), (token) => {
        // Throw để hủy chain khi quá hạn — chatStream catch lỗi nội bộ và trả failure
        if (timedOut) throw new Error('STREAM_TIMEOUT');
        if (aborted || res.writableEnded) return;
        tokenCount++;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      });

      if (timedOut || aborted) return;

      const status = response.isCacheHit ? 'cache_hit' : response.success ? 'success' : 'error';

      stopTimer({ status });
      metrics.chatbotRequestsTotal.inc({
        endpoint: 'stream',
        status,
      });

      if (!aborted && !res.writableEnded) {
        // Đảm bảo nếu chưa gửi token nào nhưng có message (kể cả fallback/error message)
        // thì stream ra client trước khi gửi done để tránh hiển thị bong bóng rỗng
        if (tokenCount === 0 && response.message) {
          res.write(`data: ${JSON.stringify({ type: 'token', content: response.message })}\n\n`);
        }
        if (response.correctedMessage) {
          res.write(
            `data: ${JSON.stringify({ type: 'correction', content: response.correctedMessage })}\n\n`,
          );
        }
        res.write(
          `data: ${JSON.stringify({ type: 'done', success: response.success, messageId: response.messageId ?? null })}\n\n`,
        );
      }
      res.end();
    } catch (error) {
      logger.error('[Chatbot] Stream error:', { error });
      metrics.chatbotErrorsTotal.inc({ stage: 'stream_controller' });
      if (!timedOut && !aborted) {
        stopTimer({ status: 'error' });
        metrics.chatbotRequestsTotal.inc({ endpoint: 'stream', status: 'error' });
      }
      if (!aborted && !timedOut && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: 'Xin lỗi, hệ thống đang bận. Bạn vui lòng thử lại sau nhé!' })}\n\n`,
        );
      }
      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      clearTimeout(streamTimeoutTimer);
      await releaseSessionLock(chatSessionId).catch(() => {});
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

    // Verify session ownership — caller must own this session
    if (sessionId) {
      resolveChatSession(req, res, sessionId);
    }

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

    metrics.chatbotRequestsTotal.inc({ endpoint: 'feedback', status: 'success' });

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
