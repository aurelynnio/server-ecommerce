const { Conversation, Message } = require("../models/conversation.model");
const Shop = require("../models/shop.model");
const { getIO } = require("../socket/index");

class ChatService {
  async startConversation(userId, { shopId, productId }) {
    const shop = await Shop.findById(shopId);
    if (!shop) throw new Error("Shop not found");

    const sellerId = shop.owner;

    // Check existing conversation
    let conversation = await Conversation.findOne({
      members: { $all: [userId, sellerId] },
      shopId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        members: [userId, sellerId],
        shopId,
        context: { productId },
      });
    }

    return conversation;
  }

  async sendMessage(senderId, { conversationId, content, attachments }) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (!conversation.members.includes(senderId)) {
      throw new Error("You are not in this conversation");
    }

    const info = await Message.create({
      conversationId,
      senderId,
      content,
      attachments,
    });

    // Update last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        content,
        senderId,
        createdAt: new Date(),
      },
    });

    // Socket.io emit
    const io = getIO();
    if (io) {
      io.to(conversationId).emit("new_message", info);
    }

    return info;
  }

  async getMyConversations(userId) {
    const conversations = await Conversation.find({ members: userId })
      .populate("shopId", "name logo")
      .populate("members", "username avatar") // Be careful exposing sensitive info
      .sort({ updatedAt: -1 });
    return conversations;
  }

  async getMessages(conversationId) {
    // Basic check omitted, but usually verify user membership here too
    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });
    return messages;
  }
}

module.exports = new ChatService();
