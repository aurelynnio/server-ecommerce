const { Types } = require('mongoose');
const { Conversation, Message } = require('../models/conversation.model');
const BaseRepository = require('./base.repository');

const toObjectId = (id) =>
  typeof id === 'string' && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;

class ConversationRepository extends BaseRepository {
  constructor() {
    super(Conversation);
  }

  findByMembersAndShop(userId, sellerId, shopId) {
    return this.findOneByFilter({
      members: { $all: [userId, sellerId] },
      shopId,
    });
  }

  createConversation({ members, shopId, productId }) {
    return this.create({
      members,
      shopId,
      context: { productId },
    });
  }

  findByMemberWithDetails(userId, limit = 200) {
    return this.findManyByFilter({ members: userId })
      .populate('shopId', 'name logo slug owner')
      .populate('members', 'username avatar')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }
}

class MessageRepository extends BaseRepository {
  constructor() {
    super(Message);
  }

  countByConversationId(conversationId) {
    return this.countByFilter({ conversationId });
  }

  findByConversationWithPagination(conversationId, { skip, limit }) {
    return this.findManyByFilter({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  markUnreadAsReadByConversationAndReceiver(conversationId, userId) {
    return this.updateManyByFilter(
      {
        conversationId,
        senderId: { $ne: userId },
        isRead: false,
      },
      { $set: { isRead: true } },
    );
  }

  aggregateUnreadCountsForUserByConversation(userId, conversationIds = []) {
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.aggregateByPipeline([
      {
        $match: {
          conversationId: { $in: conversationIds.map(toObjectId) },
          senderId: { $ne: toObjectId(userId) },
          isRead: false,
        },
      },
      {
        $group: {
          _id: '$conversationId',
          count: { $sum: 1 },
        },
      },
    ]);
  }
}

module.exports = {
  Conversation: new ConversationRepository(),
  Message: new MessageRepository(),
};
