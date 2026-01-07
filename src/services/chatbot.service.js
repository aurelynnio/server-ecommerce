const mongoose = require("mongoose");

/**
 * Service handling chatbot operations
 * Manages chat sessions, history, and suggestions
 */
class ChatbotService {
  /**
   * Get chat history for a session
   * @param {string} sessionId - Chat session ID
   * @returns {Promise<Array>} Formatted chat messages
   */
  async getChatHistory(sessionId) {
    const collection = mongoose.connection.collection("chatbot_messages");
    const messages = await collection
      .find({ sessionId })
      .sort({ _id: 1 })
      .toArray();

    return messages.map((msg) => ({
      role: msg.type === "human" ? "user" : "assistant",
      content: msg.data?.content || "",
      timestamp: msg._id.getTimestamp(),
    }));
  }

  /**
   * Clear chat session
   * @param {string} sessionId - Chat session ID
   * @returns {Promise<Object>} Deletion result
   */
  async clearSession(sessionId) {
    const collection = mongoose.connection.collection("chatbot_messages");
    const result = await collection.deleteMany({ sessionId });
    return {
      deletedCount: result.deletedCount,
      message: "Session cleared successfully",
    };
  }

  /**
   * Get chat suggestions based on context
   * @param {string} [context] - Optional context for personalized suggestions
   * @returns {Promise<Array>} List of suggested messages
   */
  async getSuggestions(context = null) {
    const defaultSuggestions = [
      "Tôi muốn tìm áo thun nam",
      "Có sản phẩm nào đang giảm giá không?",
      "Gợi ý cho tôi sản phẩm hot nhất",
      "Tôi cần tư vấn chọn size",
      "Có freeship không?",
      "Chính sách đổi trả như thế nào?",
      "Làm sao để theo dõi đơn hàng?",
      "Tôi muốn liên hệ với shop",
    ];

    // Could be extended to provide personalized suggestions based on user history
    return defaultSuggestions;
  }

  /**
   * Get all chat sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of chat sessions
   */
  async getUserSessions(userId) {
    const collection = mongoose.connection.collection("chatbot_messages");
    const sessions = await collection.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$sessionId",
          lastMessage: { $last: "$data.content" },
          messageCount: { $sum: 1 },
          createdAt: { $first: "$_id" },
          updatedAt: { $last: "$_id" },
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: 20 },
    ]).toArray();

    return sessions.map((s) => ({
      sessionId: s._id,
      lastMessage: s.lastMessage,
      messageCount: s.messageCount,
      createdAt: s.createdAt.getTimestamp(),
      updatedAt: s.updatedAt.getTimestamp(),
    }));
  }

  /**
   * Save feedback for a chatbot response
   * @param {string} sessionId - Chat session ID
   * @param {string} messageId - Message ID
   * @param {string} feedback - Feedback type (helpful/not_helpful)
   * @param {string} [comment] - Optional feedback comment
   * @returns {Promise<Object>} Saved feedback
   */
  async saveFeedback(sessionId, messageId, feedback, comment = null) {
    const collection = mongoose.connection.collection("chatbot_feedback");
    const result = await collection.insertOne({
      sessionId,
      messageId,
      feedback,
      comment,
      createdAt: new Date(),
    });

    return {
      id: result.insertedId,
      message: "Feedback saved successfully",
    };
  }
}

module.exports = new ChatbotService();
