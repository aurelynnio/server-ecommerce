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

router.post('/message', chatbotRateLimiter, validate(chatMessageValidator), chatbotController.sendMessage);

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
 * @desc    Get chatbot status (feature flag cho client canary)
 * @access  Public
 */
router.get('/status', chatbotController.getStatus);

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

/**
 * @desc    Lưu feedback cho 1 message chatbot
 * @access  Public
 * @body    { sessionId, messageId, rating: 'up'|'down', comment? }
 */
router.post('/feedback', chatbotRateLimiter, chatbotController.feedback);

/**
 * @desc    GDPR: xoá toàn bộ message của 1 session (Admin)
 * @access  Private (Admin)
 */
router.delete(
  '/admin/sessions/:sessionId',
  verifyAccessToken,
  requireRole('admin'),
  validate({ params: sessionIdParamValidator }),
  chatbotController.adminDeleteSession,
);

module.exports = router;
