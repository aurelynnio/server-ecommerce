const catchAsync = require("../configs/catchAsync");
const chatbotService = require("../chatbot");
const mongoose = require("mongoose");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");
const logger = require("../utils/logger");

const ChatbotController = {
  /**
   * Send message to chatbot (non-streaming)

   */
  sendMessage: catchAsync(async (req, res) => {
    const { message, sessionId } = req.body;
    const userId = req.user?._id || null;

    if (!message || !message.trim()) {
      return sendFail(res, "Message is required", StatusCodes.BAD_REQUEST);
    }

    const chatSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const response = await chatbotService.chat(chatSessionId, message.trim());

    return sendSuccess(
      res,
      { ...response, sessionId: chatSessionId },
      response.success
        ? "Message sent successfully"
        : "Failed to process message",
      response.success ? StatusCodes.OK : StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }),

  /**
   * Stream message to chatbot using SSE

   */
  streamMessage: catchAsync(async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return sendFail(res, "Message is required", StatusCodes.BAD_REQUEST);
    }

    const chatSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    // Send sessionId first
    res.write(
      `data: ${JSON.stringify({ type: "session", sessionId: chatSessionId })}\n\n`,
    );

    try {
      const response = await chatbotService.chatStream(
        chatSessionId,
        message.trim(),
        (token) => {
          // Send each token as SSE event
          res.write(
            `data: ${JSON.stringify({ type: "token", content: token })}\n\n`,
          );
        },
      );

      // Send completion event
      res.write(
        `data: ${JSON.stringify({ type: "done", success: response.success })}\n\n`,
      );
      res.end();
    } catch (error) {
      logger.error("[Chatbot] Stream error:", { error });
      res.write(
        `data: ${JSON.stringify({ type: "error", message: "Có lỗi xảy ra" })}\n\n`,
      );
      res.end();
    }
  }),

  /**
   * Get chat history

   */
  getHistory: catchAsync(async (req, res) => {
    const { sessionId } = req.params;

    const collection = mongoose.connection.collection("chatbot_messages");
    const messages = await collection
      .find({ sessionId })
      .sort({ _id: 1 })
      .toArray();

    const formattedMessages = messages.map((msg) => ({
      role: msg.type === "human" ? "user" : "assistant",
      content: msg.data?.content || "",
      timestamp: msg._id.getTimestamp(),
    }));

    return sendSuccess(
      res,
      { sessionId, messages: formattedMessages },
      "Chat history retrieved successfully",
      StatusCodes.OK,
    );
  }),

  /**
   * Clear chat session

   */
  clearSession: catchAsync(async (req, res) => {
    const { sessionId } = req.params;

    const collection = mongoose.connection.collection("chatbot_messages");
    await collection.deleteMany({ sessionId });

    return sendSuccess(
      res,
      null,
      "Session cleared successfully",
      StatusCodes.OK,
    );
  }),

  /**
   * Get chat suggestions

   */
  getSuggestions: catchAsync(async (_req, res) => {
    const suggestions = [
      "Tôi muốn tìm áo thun nam",
      "Có sản phẩm nào đang giảm giá không?",
      "Gợi ý cho tôi sản phẩm hot nhất",
      "Tôi cần tư vấn chọn size",
      "Có freeship không?",
    ];

    return sendSuccess(
      res,
      { suggestions },
      "Suggestions retrieved successfully",
      StatusCodes.OK,
    );
  }),
  /**
   * Get all chat sessions (Admin)
   */
  getAllSessions: catchAsync(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const collection = mongoose.connection.collection("chatbot_messages");

    // Aggregate to get unique sessions with metadata
    const sessions = await collection
      .aggregate([
        {
          $sort: { _id: 1 }, // Sort by time to ensure first/last logic works
        },
        {
          $group: {
            _id: "$sessionId",
            lastMessageAt: { $max: "$_id" },
            createdAt: { $min: "$_id" },
            messageCount: { $sum: 1 },
            lastMessage: { $last: "$data.content" },
          },
        },
        {
          $sort: { lastMessageAt: -1 }, // Sort sessions by latest activity
        },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: skip }, { $limit: parseInt(limit) }],
          },
        },
      ])
      .toArray();

    const result = sessions[0];
    const total = result.metadata[0]?.total || 0;
    const sessionData = result.data.map((s) => ({
      sessionId: s._id,
      lastMessage: s.lastMessage,
      messageCount: s.messageCount,
      createdAt: s.createdAt.getTimestamp(),
      updatedAt: s.lastMessageAt.getTimestamp(),
    }));

    return sendSuccess(
      res,
      {
        data: sessionData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Chat sessions retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = ChatbotController;
