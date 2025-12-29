const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbot.controller");
const { chatbotLimiter } = require("../middlewares/rateLimited.middleware");

/**
 * @route   POST /api/chatbot/message
 * @desc    Send message to AI chatbot (non-streaming)
 * @access  Public
 * @body    { message, sessionId? }
 */
router.post("/message", chatbotLimiter, chatbotController.sendMessage);

/**
 * @route   POST /api/chatbot/stream
 * @desc    Send message to AI chatbot with streaming response (SSE)
 * @access  Public
 * @body    { message, sessionId? }
 */
router.post("/stream", chatbotLimiter, chatbotController.streamMessage);

/**
 * @route   GET /api/chatbot/history/:sessionId
 * @desc    Get chat history by session ID
 * @access  Public
 */
router.get("/history/:sessionId", chatbotController.getHistory);

/**
 * @route   DELETE /api/chatbot/session/:sessionId
 * @desc    Clear chat session
 * @access  Public
 */
router.delete("/session/:sessionId", chatbotController.clearSession);

/**
 * @route   GET /api/chatbot/suggestions
 * @desc    Get chat suggestions for user
 * @access  Public
 */
router.get("/suggestions", chatbotController.getSuggestions);

module.exports = router;
