
const express = require("express");

const router = express.Router();

const chatbotController = require("../controllers/chatbot.controller");

const { chatbotLimiter } = require("../middlewares/rateLimited.middleware");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");

/**
 * @desc    Send message to AI chatbot (non-streaming)
 * @access  Public
 * @body    { message, sessionId? }
 */
router.post("/message", chatbotLimiter, chatbotController.sendMessage);

/**
 * @desc    Send message to AI chatbot with streaming response (SSE)
 * @access  Public
 * @body    { message, sessionId? }
 */
router.post("/stream", chatbotLimiter, chatbotController.streamMessage);

/**
 * @desc    Get chat history by session ID
 * @access  Public
 */
router.get("/history/:sessionId", chatbotController.getHistory);

/**
 * @desc    Clear chat session
 * @access  Public
 */
router.delete("/session/:sessionId", chatbotController.clearSession);

/**
 * @desc    Get chat suggestions for user
 * @access  Public
 */
router.get("/suggestions", chatbotController.getSuggestions);

/**
 * Admin Routes
 */
/**
 * @desc    Get all chat sessions (Admin)
 * @access  Private (Admin)
 */
router.get(
  "/admin/sessions",
  verifyAccessToken,
  requireRole("admin"),
  chatbotController.getAllSessions
);

module.exports = router;
