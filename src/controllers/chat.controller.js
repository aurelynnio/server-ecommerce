const chatService = require('../services/chat.service');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const ChatController = {
  /**
   * Start conversation
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  startConversation: catchAsync(async (req, res) => {
    const conversation = await chatService.startConversation(req.user.userId, req.body);
    return sendSuccess(res, conversation, 'Conversation started', StatusCodes.OK);
  }),

  /**
   * Send message
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  sendMessage: catchAsync(async (req, res) => {
    const info = await chatService.sendMessage(req.user.userId, req.body);
    return sendSuccess(res, info, 'Message sent', StatusCodes.CREATED);
  }),

  /**
   * Send message with uploaded media/files
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  sendMediaMessage: catchAsync(async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const { conversationId, content = '' } = req.body;

    if (!conversationId) {
      return sendFail(res, 'Conversation ID is required', StatusCodes.BAD_REQUEST);
    }

    if (files.length === 0) {
      return sendFail(res, 'No files uploaded', StatusCodes.BAD_REQUEST);
    }

    const info = await chatService.sendMediaMessage(req.user.userId, {
      conversationId,
      content,
      files,
    });

    return sendSuccess(res, info, 'Media message sent', StatusCodes.CREATED);
  }),

  /**
   * Get my conversations
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getMyConversations: catchAsync(async (req, res) => {
    const conversations = await chatService.getMyConversations(req.user.userId);
    return sendSuccess(res, conversations, 'Get conversations success', StatusCodes.OK);
  }),

  /**
   * Get messages
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getMessages: catchAsync(async (req, res) => {
    const messages = await chatService.getMessages(
      req.params.conversationId,
      req.user.userId,
      req.query,
    );
    return sendSuccess(res, messages, 'Get messages success', StatusCodes.OK);
  }),

  /**
   * Mark as read
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  markAsRead: catchAsync(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const result = await chatService.markAsRead(conversationId, userId);
    return sendSuccess(res, result, 'Messages marked as read', StatusCodes.OK);
  }),
};

module.exports = ChatController;
