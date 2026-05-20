const { Conversation, Message } = require('../repositories/conversation.repository');
const Shop = require('../repositories/shop.repository');
const { getIO } = require('../socket/index');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { uploadAsset } = require('../configs/cloudinary');

class ChatService {
  _isSameId(left, right) {
    return String(left) === String(right);
  }

  _getSenderType(senderId, shopOwnerId) {
    return this._isSameId(senderId, shopOwnerId) ? 'shop' : 'user';
  }

  _normalizeAttachments(attachments = []) {
    return (attachments || []).map((attachment) => {
      if (typeof attachment === 'string') {
        return {
          url: attachment,
          fileName: attachment.split('/').pop() || 'attachment',
          mimeType: '',
          size: 0,
          resourceType: 'raw',
        };
      }

      return {
        url: attachment.url,
        fileName: attachment.fileName || attachment.url?.split('/').pop() || 'attachment',
        mimeType: attachment.mimeType || '',
        size: attachment.size || 0,
        resourceType: attachment.resourceType || 'raw',
      };
    });
  }

  _buildMessagePreview({ content = '', messageType = 'text', attachments = [] }) {
    if (content?.trim()) {
      return content.trim();
    }

    if (messageType === 'image') {
      return attachments.length > 1 ? `Đã gửi ${attachments.length} ảnh` : 'Đã gửi một ảnh';
    }

    if (messageType === 'file') {
      return attachments.length > 1 ? `Đã gửi ${attachments.length} tệp` : 'Đã gửi một tệp';
    }

    if (messageType === 'product') {
      return 'Đã chia sẻ sản phẩm';
    }

    return '';
  }

  _transformMessage(message, { shopOwnerId }) {
    const senderId = message.senderId?._id || message.senderId;
    const normalizedAttachments = this._normalizeAttachments(message.attachments);

    return {
      _id: message._id,
      conversation: String(message.conversationId),
      sender: String(senderId),
      senderType: this._getSenderType(senderId, shopOwnerId),
      content: message.content,
      messageType: message.messageType || 'text',
      attachments: normalizedAttachments,
      productRef: message.productRef ? String(message.productRef) : undefined,
      isRead: !!message.isRead,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  _transformConversation(conversation, userId, unreadCount = 0) {
    const shop = conversation.shopId || {};
    const shopOwnerId = shop.owner?._id || shop.owner;
    const otherMember = (conversation.members || []).find(
      (member) => !this._isSameId(member._id || member, shopOwnerId),
    );

    const userParticipant = otherMember || {};
    const lastMessagePreview = this._buildMessagePreview({
      content: conversation.lastMessage?.content,
      messageType: conversation.lastMessage?.messageType || 'text',
      attachments: this._normalizeAttachments(conversation.lastMessage?.attachments),
    });
    const lastMessage = conversation.lastMessage?.content
      || conversation.lastMessage?.attachments?.length
      ? {
          _id: `${conversation._id}-last-message`,
          conversation: String(conversation._id),
          sender: String(conversation.lastMessage.senderId || ''),
          senderType: this._getSenderType(conversation.lastMessage.senderId, shopOwnerId),
          content: lastMessagePreview,
          messageType: conversation.lastMessage.messageType || 'text',
          attachments: this._normalizeAttachments(conversation.lastMessage.attachments),
          isRead: unreadCount === 0,
          createdAt: conversation.lastMessage.createdAt,
          updatedAt: conversation.lastMessage.createdAt,
        }
      : undefined;

    return {
      _id: String(conversation._id),
      user: {
        _id: String(userParticipant._id || userId),
        name: userParticipant.username || 'Khách hàng',
        avatar: userParticipant.avatar || null,
      },
      shop: {
        _id: String(shop._id || ''),
        name: shop.name || 'Cửa hàng',
        avatar: shop.logo || null,
        shopId: shop.slug || String(shop._id || ''),
      },
      lastMessage,
      unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  async _getConversationWithAccessCheck(conversationId, userId) {
    const conversation = await Conversation.findById(conversationId)
      .populate('shopId', 'name logo slug owner')
      .populate('members', 'username avatar')
      .lean();

    if (!conversation) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
    }

    const isMember = conversation.members.some((member) =>
      this._isSameId(member._id || member, userId),
    );

    if (!isMember) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You are not in this conversation');
    }

    return conversation;
  }

  async _persistMessage(senderId, {
    conversationId,
    content = '',
    attachments = [],
    messageType = 'text',
    productRef = null,
  }) {
    const conversation = await this._getConversationWithAccessCheck(conversationId, senderId);
    const normalizedAttachments = this._normalizeAttachments(attachments);

    const info = await Message.create({
      conversationId,
      senderId,
      content: content?.trim?.() || '',
      attachments: normalizedAttachments,
      messageType,
      productRef,
    });

    await Conversation.updateById(conversationId, {
      lastMessage: {
        content: content?.trim?.() || '',
        senderId,
        createdAt: new Date(),
        messageType,
        attachments: normalizedAttachments,
      },
    });

    const payload = this._transformMessage(info.toObject ? info.toObject() : info, {
      shopOwnerId: conversation?.shopId?.owner,
    });

    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('new_message', payload);
    }

    return payload;
  }

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

    const detailedConversation = await Conversation.findById(conversation._id)
      .populate('shopId', 'name logo slug owner')
      .populate('members', 'username avatar')
      .lean();

    return this._transformConversation(detailedConversation, userId, 0);
  }

  /**
   * Send message
   * @param {string} senderId
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async sendMessage(senderId, {
    conversationId,
    content,
    attachments,
    messageType,
    productRef,
  }) {
    return this._persistMessage(senderId, {
      conversationId,
      content,
      attachments,
      messageType:
        messageType ||
        (attachments?.length
          ? this._normalizeAttachments(attachments).every((attachment) =>
              attachment.mimeType?.startsWith('image/'),
            )
            ? 'image'
            : 'file'
          : productRef
            ? 'product'
            : 'text'),
      productRef,
    });
  }

  async sendMediaMessage(senderId, { conversationId, content = '', files = [] }) {
    const uploadedAttachments = await Promise.all(
      files.map(async (file) => {
        const resourceType = file.mimetype?.startsWith('image/') ? 'image' : 'raw';
        const result = await uploadAsset(file.buffer, {
          folder: 'chat',
          resourceType,
          originalFilename: file.originalname,
        });

        return {
          url: result.secure_url,
          fileName: file.originalname,
          mimeType: file.mimetype || '',
          size: file.size || 0,
          resourceType,
        };
      }),
    );

    const hasOnlyImages = uploadedAttachments.every((attachment) =>
      attachment.mimeType.startsWith('image/'),
    );

    return this._persistMessage(senderId, {
      conversationId,
      content,
      attachments: uploadedAttachments,
      messageType: hasOnlyImages ? 'image' : 'file',
    });
  }

  /**
   * Get my conversations
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getMyConversations(userId) {
    const conversations = await Conversation.findByMemberWithDetails(userId);
    const conversationIds = conversations.map((conversation) => conversation._id);
    const unreadCounts = await Message.aggregateUnreadCountsForUserByConversation(
      userId,
      conversationIds,
    );
    const unreadCountMap = new Map(
      unreadCounts.map((item) => [String(item._id), item.count]),
    );

    return conversations.map((conversation) =>
      this._transformConversation(
        conversation.toObject ? conversation.toObject() : conversation,
        userId,
        unreadCountMap.get(String(conversation._id)) || 0,
      ),
    );
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
  async getMessages(conversationId, userId, { page = 1, limit = 50 } = {}) {
    const conversation = await this._getConversationWithAccessCheck(conversationId, userId);

    const total = await Message.countByConversationId(conversationId);
    const paginationParams = getPaginationParams(page, limit, total);

    const messages = await Message.findByConversationWithPagination(
      conversationId,
      paginationParams,
    );

    const transformedMessages = messages
      .reverse()
      .map((message) => this._transformMessage(message, { shopOwnerId: conversation.shopId?.owner }));
    const response = buildPaginationResponse(transformedMessages, paginationParams);

    return {
      messages: response.data,
      pagination: response.pagination,
    };
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
