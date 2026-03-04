const { Conversation, Message } = require('../repositories/conversation.repository');
const Shop = require('../repositories/shop.repository');
const { getIO } = require('../socket/index');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');

class ChatService {
  /**
   * Start conversation
   * @param {string} userId
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async startConversation(userId, { shopId, productId }) {
    const shop = await Shop.findById(shopId);
    if (!shop) throw new ApiError(StatusCodes.NOT_FOUND, 'Shop not found');

    const sellerId = shop.owner;

    // Check existing conversation
    let conversation = await Conversation.findByMembersAndShop(userId, sellerId, shopId);

    if (!conversation) {
      conversation = await Conversation.createConversation({
        members: [userId, sellerId],
        shopId,
        productId,
      });
    }

    return conversation;
  }

  /**
   * Send message
   * @param {string} senderId
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async sendMessage(senderId, { conversationId, content, attachments }) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
    }

    if (!conversation.members.includes(senderId)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not in this conversation');
    }

    const info = await Message.create({
      conversationId,
      senderId,
      content,
      attachments,
    });

    // Update last message
    await Conversation.updateById(conversationId, {
      lastMessage: {
        content,
        senderId,
        createdAt: new Date(),
      },
    });

    // Socket.io emit
    const io = getIO();
    if (io) {
      io.to(conversationId).emit('new_message', info);
    }

    return info;
  }

  /**
   * Get my conversations
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getMyConversations(userId) {
    const conversations = await Conversation.findByMemberWithDetails(userId);
    return conversations;
  }

  /**
   * Get messages for a conversation with pagination
   * PERFORMANCE FIX: Added pagination to prevent loading too many messages
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Pagination options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=50] - Messages per page
   * @returns {Promise<Object>} Messages with pagination
   */
  async getMessages(conversationId, { page = 1, limit = 50 } = {}) {
    const total = await Message.countByConversationId(conversationId);
    const paginationParams = getPaginationParams(page, limit, total);

    const messages = await Message.findByConversationWithPagination(
      conversationId,
      paginationParams,
    );

    const reversedMessages = messages.reverse();

    return buildPaginationResponse(reversedMessages, paginationParams);
  }

  /**
   * Mark as read
   * @param {string} conversationId
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async markAsRead(conversationId, userId) {
    // Find the conversation by ID
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
    }

    // Verify user is a member of the conversation
    const isMember = conversation.members.some(
      (memberId) => memberId.toString() === userId.toString(),
    );
    if (!isMember) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a member of this conversation');
    }

    // Update all messages where senderId != userId to isRead: true
    const result = await Message.markUnreadAsReadByConversationAndReceiver(conversationId, userId);

    return { updatedCount: result.modifiedCount };
  }
}

module.exports = new ChatService();
