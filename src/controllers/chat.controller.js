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
   * @access Private (Authenticated users)
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
   * @access Private (Authenticated users)
   */
  sendMessage: catchAsync(async (req, res) => {
    const info = await chatService.sendMessage(req.user.userId, req.body);
    return sendSuccess(res, info, "Message sent", StatusCodes.CREATED);
  }),

  /**
   * Get all conversations for current user
   * @access Private (Authenticated users)
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
   * @access Private (Authenticated users - participants only)
   */
  getMessages: catchAsync(async (req, res) => {
    const messages = await chatService.getMessages(req.params.conversationId);
    return sendSuccess(res, messages, "Get messages success", StatusCodes.OK);
  }),

  /**
   * Mark all messages in a conversation as read
   * @access Private (Authenticated users - participants only)
   */
  markAsRead: catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const result = await chatService.markAsRead(conversationId, userId);
    return sendSuccess(res, result, "Messages marked as read", StatusCodes.OK);
  }),
};

module.exports = ChatController;
