const chatService = require("../services/chat.service");
const catchAsync = require("../configs/catchAsync");
const { sendSuccess } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * Chat Controller
 * Handles real-time chat operations including conversations and messages
 */
const ChatController = {
  /**
   * Start or get an existing conversation
   * @route POST /api/chat/start
   * @access Private (Authenticated users)
   * @body {string} participantId - ID of the other participant
   * @body {string} [type] - Conversation type (user-to-user, user-to-shop)
   * @returns {Object} Conversation object
   */
  startConversation: catchAsync(async (req, res) => {
    const conversation = await chatService.startConversation(
      req.user.userId,
      req.body
    );
    return sendSuccess(
      res,
      conversation,
      "Conversation started",
      StatusCodes.OK
    );
  }),

  /**
   * Send a message in a conversation
   * @route POST /api/chat/message
   * @access Private (Authenticated users)
   * @body {string} conversationId - Conversation ID
   * @body {string} content - Message content
   * @body {string} [type] - Message type (text, image, etc.)
   * @returns {Object} Sent message object
   */
  sendMessage: catchAsync(async (req, res) => {
    const info = await chatService.sendMessage(req.user.userId, req.body);
    return sendSuccess(res, info, "Message sent", StatusCodes.CREATED);
  }),

  /**
   * Get all conversations for current user
   * @route GET /api/chat/conversations
   * @access Private (Authenticated users)
   * @returns {Array} User's conversations with last message
   */
  getMyConversations: catchAsync(async (req, res) => {
    const conversations = await chatService.getMyConversations(req.user.userId);
    return sendSuccess(
      res,
      conversations,
      "Get conversations success",
      StatusCodes.OK
    );
  }),

  /**
   * Get all messages in a conversation
   * @route GET /api/chat/messages/:conversationId
   * @access Private (Authenticated users - participants only)
   * @param {string} conversationId - Conversation ID
   * @returns {Array} Messages in the conversation
   */
  getMessages: catchAsync(async (req, res) => {
    const messages = await chatService.getMessages(req.params.conversationId);
    return sendSuccess(res, messages, "Get messages success", StatusCodes.OK);
  }),
};

module.exports = ChatController;
