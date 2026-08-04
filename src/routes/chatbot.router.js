const express = require('express');

const router = express.Router();

const chatbotController = require('../controllers/chatbot.controller');

const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { chatbotRateLimiter } = require('../middlewares/rateLimit.middleware');
const {
  chatMessageValidator,
  sessionIdParamValidator,
} = require('../validations/chatbot.validator');

/**
 * @desc    Send message to AI chatbot (non-streaming)
 * @access  Public
 * @body    { message, sessionId? }
 */
router.post('/message', chatbotRateLimiter, validate(chatMessageValidator), chatbotController.sendMessage);

/**
 * @desc    Send message to AI chatbot with streaming response (SSE)
 * @access  Public
 * @body    { message, sessionId? }
 */
router.post('/stream', chatbotRateLimiter, validate(chatMessageValidator), chatbotController.streamMessage);

/**
 * @desc    Get chat history by session ID
 * @access  Public
 */
router.get(
  '/history/:sessionId',
  validate({ params: sessionIdParamValidator }),
  chatbotController.getHistory,
);

/**
 * @desc    Clear chat session
 * @access  Public
 */
router.delete(
  '/session/:sessionId',
  validate({ params: sessionIdParamValidator }),
  chatbotController.clearSession,
);

/**
 * @desc    Get chat suggestions for user
 * @access  Public
 */
router.get('/suggestions', chatbotController.getSuggestions);

/**
 * Admin Routes
 */
/**
 * @desc    Get all chat sessions (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/sessions',
  verifyAccessToken,
  requireRole('admin'),
  chatbotController.getAllSessions,
);

module.exports = router;
