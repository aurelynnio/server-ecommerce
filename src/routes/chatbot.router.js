
const express = require("express");

const router = express.Router();

const chatbotController = require("../controllers/chatbot.controller");

const { chatbotLimiter } = require("../middlewares/rateLimited.middleware");
/**
* @desc Send message to AI chatbot (non-streaming)
* @accessPublic
 * @body    { message, sessionId? }
 */

router.post("/message", chatbotLimiter, chatbotController.sendMessage);
/**
* @desc Send message to AI chatbot with streaming response (SSE)
* @accessPublic
 * @body    { message, sessionId? }
 */

router.post("/stream", chatbotLimiter, chatbotController.streamMessage);
/**
* @desc Get chat history by session ID
* @accessPublic
 */

router.get("/history/:sessionId", chatbotController.getHistory);
/**
* @desc Clear chat session
* @accessPublic
 */

router.delete("/session/:sessionId", chatbotController.clearSession);
/**
* @desc Get chat suggestions for user
* @accessPublic
 */

router.get("/suggestions", chatbotController.getSuggestions);

module.exports = router;
