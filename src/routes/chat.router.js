const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  startConversationValidator,
  sendMessageValidator,
} = require("../validations/chat.validator");

// All chat routes require authentication
router.use(verifyAccessToken);

/**
 * @route   POST /api/chat/start
 * @desc    Start or get an existing conversation
 * @access  Private (Authenticated users)
 * @body    { participantId, type? }
 */
router.post(
  "/start",
  validate(startConversationValidator),
  chatController.startConversation
);

/**
 * @route   POST /api/chat/message
 * @desc    Send a message in a conversation
 * @access  Private (Authenticated users)
 * @body    { conversationId, content, type? }
 */
router.post(
  "/message",
  validate(sendMessageValidator),
  chatController.sendMessage
);

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for current user
 * @access  Private (Authenticated users)
 */
router.get("/conversations", chatController.getMyConversations);

/**
 * @route   GET /api/chat/messages/:conversationId
 * @desc    Get all messages in a conversation
 * @access  Private (Authenticated users - participants only)
 * @param   conversationId - Conversation ID
 */
router.get("/messages/:conversationId", chatController.getMessages);

module.exports = router;
